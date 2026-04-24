
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  MessageSquare, Send, FileText, BarChart3, Bot, Home,
  Settings, Gift, Package, Wrench, Map, Film, Tv,
  Users, DollarSign, Ticket, Database, Trophy, Zap,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton,
  SidebarMenuItem, SidebarHeader, SidebarFooter,
} from "@/components/ui/sidebar";

const menuItems = [
  { title: "Dashboard",        url: "/",                icon: Home },
  { title: "Chat",             url: "/chat",            icon: MessageSquare },
  { title: "Envio em Massa",   url: "/whatsapp/bulk",   icon: Send },
  { title: "Solicitações",     url: "/requests",        icon: FileText },
  { title: "Suporte Técnico",  url: "/technical-support", icon: Wrench },
  { title: "Mapa da Rede",     url: "/network-map",     icon: Map },
  { title: "Gráficos",         url: "/analytics",       icon: BarChart3 },
  { title: "Criar Bots",       url: "/bots",            icon: Bot },
  { title: "Sorteio",          url: "/raffle",          icon: Gift },
  { title: "Filmes",           url: "/movies",          icon: Film },
  { title: "Séries",           url: "/series",          icon: Tv },
  { title: "Gestão de Prêmios", url: "/rewards-management", icon: Package },
  { title: "Pedidos de Resgate", url: "/redemption-orders",  icon: Package },
  { title: "Configurações",    url: "/settings",        icon: Settings },
];

const ixcMenuItems = [
  { title: "Consulta de Clientes", url: "/ixc/consulta",   icon: Users },
  { title: "Financeiro",           url: "/ixc/financeiro",  icon: DollarSign },
  { title: "Tickets de Suporte",   url: "/ixc/tickets",     icon: Ticket },
];

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.04, delayChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, x: -16 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.3, ease: 'easeOut' } },
};

export function AppSidebar() {
  const location = useLocation();

  return (
    <Sidebar className="border-r-0" style={{ background: 'transparent' }}>
      {/* Dark glass background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(180deg, #0F172A 0%, #0F172A 60%, #0D1526 100%)',
          borderRight: '1px solid rgba(255,255,255,0.07)',
        }}
      />

      {/* Ambient glow top */}
      <div
        className="absolute top-0 left-0 right-0 h-48 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 80% 100% at 50% 0%, rgba(37,99,235,0.15) 0%, transparent 70%)',
        }}
      />

      {/* ── Header ─────────────────────────── */}
      <SidebarHeader className="relative z-10 p-5 pb-4">
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="flex items-center gap-3"
        >
          {/* Logo icon with pulse glow */}
          <motion.div
            className="w-9 h-9 rounded-xl flex items-center justify-center relative"
            style={{
              background: 'linear-gradient(135deg, #2563EB, #7C3AED)',
            }}
            animate={{ boxShadow: [
              '0 0 8px rgba(37,99,235,0.4)',
              '0 0 20px rgba(37,99,235,0.8), 0 0 40px rgba(124,58,237,0.4)',
              '0 0 8px rgba(37,99,235,0.4)',
            ]}}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Zap className="w-5 h-5 text-white" />
          </motion.div>

          <div>
            <h2 className="text-base font-bold text-white leading-none tracking-wide">
              AVL Control
            </h2>
            <p className="text-[10px] font-medium mt-0.5" style={{ color: 'rgba(148,163,184,0.8)' }}>
              Command Center
            </p>
          </div>
        </motion.div>

        {/* Divider */}
        <div
          className="mt-4 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)' }}
        />
      </SidebarHeader>

      {/* ── Content ────────────────────────── */}
      <SidebarContent className="relative z-10 px-3 py-2">

        {/* Main nav */}
        <SidebarGroup>
          <SidebarGroupLabel
            className="text-xs font-semibold mb-2 px-2 tracking-widest uppercase"
            style={{ color: 'rgba(148,163,184,0.5)' }}
          >
            Navegação
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              <SidebarMenu className="space-y-0.5">
                {menuItems.map((item) => {
                  const isActive = location.pathname === item.url;
                  return (
                    <motion.div key={item.title} variants={itemVariants}>
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild>
                          <Link
                            to={item.url}
                            className="group relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200"
                            style={{
                              background: isActive
                                ? 'linear-gradient(135deg, rgba(37,99,235,0.25), rgba(124,58,237,0.15))'
                                : 'transparent',
                              border: isActive
                                ? '1px solid rgba(37,99,235,0.3)'
                                : '1px solid transparent',
                            }}
                          >
                            {/* Active neon left bar */}
                            <AnimatePresence>
                              {isActive && (
                                <motion.div
                                  initial={{ scaleY: 0, opacity: 0 }}
                                  animate={{ scaleY: 1, opacity: 1 }}
                                  exit={{ scaleY: 0, opacity: 0 }}
                                  transition={{ duration: 0.2 }}
                                  className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full"
                                  style={{ background: 'linear-gradient(180deg, #60A5FA, #7C3AED)' }}
                                />
                              )}
                            </AnimatePresence>

                            {/* Icon */}
                            <motion.div
                              whileHover={{ scale: 1.15, rotate: 5 }}
                              transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                            >
                              <item.icon
                                className="w-4.5 h-4.5 transition-colors duration-200"
                                style={{
                                  color: isActive ? '#60A5FA' : 'rgba(148,163,184,0.7)',
                                  width: 18, height: 18,
                                }}
                              />
                            </motion.div>

                            {/* Label */}
                            <span
                              className="text-sm font-medium transition-colors duration-200"
                              style={{ color: isActive ? '#F1F5F9' : 'rgba(148,163,184,0.75)' }}
                            >
                              {item.title}
                            </span>

                            {/* Hover shimmer */}
                            {!isActive && (
                              <div
                                className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none"
                                style={{ background: 'rgba(255,255,255,0.04)' }}
                              />
                            )}
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    </motion.div>
                  );
                })}
              </SidebarMenu>
            </motion.div>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Divider */}
        <div
          className="my-3 h-px mx-2"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.07), transparent)' }}
        />

        {/* IXC section */}
        <SidebarGroup>
          <SidebarGroupLabel
            className="text-xs font-semibold mb-2 px-2 tracking-widest uppercase flex items-center gap-2"
            style={{ color: 'rgba(148,163,184,0.5)' }}
          >
            <Database style={{ width: 10, height: 10 }} />
            Sistema IXC
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              <SidebarMenu className="space-y-0.5">
                {ixcMenuItems.map((item) => {
                  const isActive = location.pathname === item.url;
                  return (
                    <motion.div key={item.title} variants={itemVariants}>
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild>
                          <Link
                            to={item.url}
                            className="group relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200"
                            style={{
                              background: isActive
                                ? 'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(5,150,105,0.1))'
                                : 'transparent',
                              border: isActive
                                ? '1px solid rgba(16,185,129,0.3)'
                                : '1px solid transparent',
                            }}
                          >
                            <AnimatePresence>
                              {isActive && (
                                <motion.div
                                  initial={{ scaleY: 0, opacity: 0 }}
                                  animate={{ scaleY: 1, opacity: 1 }}
                                  exit={{ scaleY: 0, opacity: 0 }}
                                  className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full"
                                  style={{ background: 'linear-gradient(180deg, #34D399, #059669)' }}
                                />
                              )}
                            </AnimatePresence>

                            <item.icon
                              style={{
                                width: 18, height: 18,
                                color: isActive ? '#34D399' : 'rgba(148,163,184,0.7)',
                              }}
                            />
                            <span
                              className="text-sm font-medium"
                              style={{ color: isActive ? '#F1F5F9' : 'rgba(148,163,184,0.75)' }}
                            >
                              {item.title}
                            </span>

                            {!isActive && (
                              <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none" style={{ background: 'rgba(255,255,255,0.04)' }} />
                            )}
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    </motion.div>
                  );
                })}
              </SidebarMenu>
            </motion.div>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* ── Footer ────────────────────────── */}
      <SidebarFooter className="relative z-10 p-3 pb-4">
        <div
          className="h-px mb-3 mx-1"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.07), transparent)' }}
        />
        <motion.div
          whileHover={{ scale: 1.02 }}
          className="flex items-center gap-3 p-3 rounded-xl cursor-pointer"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <motion.div
            className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white"
            style={{ background: 'linear-gradient(135deg, #2563EB, #7C3AED)' }}
            animate={{ boxShadow: ['0 0 6px rgba(37,99,235,0.4)', '0 0 14px rgba(37,99,235,0.7)', '0 0 6px rgba(37,99,235,0.4)'] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            A
          </motion.div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white leading-none">Admin</p>
            <p className="text-xs mt-0.5 truncate" style={{ color: 'rgba(148,163,184,0.6)' }}>
              AVL Telecom
            </p>
          </div>
          <div className="w-2 h-2 rounded-full bg-emerald-400" style={{ boxShadow: '0 0 6px rgba(52,211,153,0.8)' }} />
        </motion.div>
      </SidebarFooter>
    </Sidebar>
  );
}

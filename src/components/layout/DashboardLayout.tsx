
import React from 'react';
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from './AppSidebar';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gray-50">
        <AppSidebar />
        <main className="flex-1 flex flex-col">
          <header className="bg-white border-b px-6 py-4 flex items-center gap-4">
            <SidebarTrigger className="text-gray-600 hover:text-gray-900" />
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900">Dashboard de Controle</h1>
              <p className="text-gray-600">Gerencie seu aplicativo de forma centralizada</p>
            </div>
          </header>
          <div className="flex-1 p-6">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}

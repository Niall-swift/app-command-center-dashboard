import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from '@/contexts/AuthContext';
import { Gift, Trophy, Users, ArrowRight, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const { user, userData } = useAuth();

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Olá, {userData?.name || user?.displayName || 'Usuário'}! 👋</h1>
          <p className="text-gray-600">Bem-vindo ao seu painel de controle.</p>
        </div>
        <div className="flex gap-2">
          {/* <Button variant="outline">Ver Perfil</Button> */}
        </div>
      </div>

      {/* Quick Stats / Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Placeholder for future widgets or remove the grid if empty */}
        
      </div>

      {/* Main Content Placeholder (or recent activity) */}
      {/* 
      <Card>
        <CardHeader>
          <CardTitle>Atividades Recentes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-10 text-gray-500">
            Nenhuma atividade recente para exibir.
          </div>
        </CardContent>
      </Card> 
      */}
    </div>
  );
}

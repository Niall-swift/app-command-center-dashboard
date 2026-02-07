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
        
        {/* Points Widget */}
        <Card className="bg-gradient-to-br from-purple-600 to-indigo-700 text-white border-0 shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Gift size={100} />
          </div>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-purple-100">
              <Sparkles className="w-5 h-5 text-yellow-300" />
              Seus Pontos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <span className="text-4xl font-bold">{userData?.points || 0}</span>
              <span className="text-purple-200 ml-2">pts</span>
            </div>
            <Button asChild variant="secondary" className="w-full bg-white/10 hover:bg-white/20 text-white border-0">
              <Link to="/rewards">
                Trocar por Prêmios <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Referrals Widget */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-gray-700">
              <Users className="w-5 h-5 text-blue-600" />
              Indicações
            </CardTitle>
            <CardDescription>Ganhe pontos indicando amigos</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
               <div className="text-2xl font-bold text-gray-900">
                {userData?.referrals?.length || 0}
                <span className="text-sm font-normal text-gray-500 ml-2">amigos indicados</span>
               </div>
            </div>
            <Button asChild variant="outline" className="w-full">
              <Link to="/my-referrals">
                Ver Meu Código <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Leaderboard Widget */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-gray-700">
              <Trophy className="w-5 h-5 text-yellow-500" />
              Ranking
            </CardTitle>
            <CardDescription>Veja sua posição no ranking global</CardDescription>
          </CardHeader>
          <CardContent>
             <div className="mb-4 text-center py-2">
               <p className="text-sm text-gray-500">Confira quem está no topo!</p>
             </div>
            <Button asChild variant="outline" className="w-full">
              <Link to="/leaderboard">
                Ver Ranking Completo <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
          </CardContent>
        </Card>

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

import React, { useState, useEffect } from 'react';
import PageTransition from '@/components/PageTransition';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Trophy, Medal, Star, Crown } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { leaderboardService, LeaderboardEntry } from '@/services/leaderboardService';
import { motion } from 'framer-motion';

export default function Leaderboard() {
  const { user } = useAuth();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [userRank, setUserRank] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      setLoading(true);
      try {
        const data = await leaderboardService.getLeaderboard(20);
        setLeaderboard(data);
        
        if (user) {
          const rank = await leaderboardService.getUserRank(user.uid);
          setUserRank(rank);
        }
      } catch (error) {
        console.error('Erro ao carregar leaderboard:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, [user]);

  const getMedalColor = (rank: number) => {
    switch (rank) {
      case 1: return 'text-yellow-400';
      case 2: return 'text-gray-400';
      case 3: return 'text-amber-600';
      default: return 'text-white/50';
    }
  };

  const getRowBackground = (rank: number, isCurrentUser: boolean) => {
    if (isCurrentUser) return 'bg-purple-50 border-purple-200';
    switch (rank) {
      case 1: return 'bg-yellow-50/50';
      case 2: return 'bg-gray-50/50';
      case 3: return 'bg-orange-50/50';
      default: return 'bg-white';
    }
  };

  return (
    <PageTransition>
      <div className="max-w-4xl mx-auto space-y-8 pb-10">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Ranking de Pontuação</h1>
          <p className="text-gray-600">Veja quem são os maiores acumuladores de pontos!</p>
        </div>

        {/* Top 3 Podium (Optional, simple list for now) */}
        
        <Card className="overflow-hidden border-0 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-purple-800 to-indigo-900 text-white p-6">
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-xl flex items-center gap-2">
                  <Trophy className="text-yellow-400" />
                  Top Indicadores
                </CardTitle>
                <p className="text-purple-200 text-sm mt-1">Atualizado em tempo real</p>
              </div>
              {userRank > 0 && (
                <div className="text-right">
                  <p className="text-purple-200 text-xs uppercase font-bold tracking-wider">Sua Posição</p>
                  <p className="text-3xl font-bold text-white">#{userRank}</p>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center text-gray-500">
                Carregando ranking...
              </div>
            ) : leaderboard.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                Nenhum dado disponível.
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {leaderboard.map((entry, index) => {
                  const isCurrentUser = user?.uid === entry.userId;
                  const rank = index + 1;
                  
                  return (
                    <motion.div 
                      key={entry.userId}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className={`flex items-center p-4 hover:bg-gray-50 transition-colors ${getRowBackground(rank, isCurrentUser)}`}
                    >
                      <div className="w-12 text-center font-bold text-lg text-gray-500 flex justify-center">
                        {rank <= 3 ? (
                          rank === 1 ? <Crown className="w-6 h-6 text-yellow-500 fill-yellow-500" /> :
                          <Medal className={`w-6 h-6 ${getMedalColor(rank)} fill-current`} />
                        ) : (
                          <span className="text-gray-400">#{rank}</span>
                        )}
                      </div>
                      
                      <Avatar className={`w-10 h-10 border-2 ${rank === 1 ? 'border-yellow-400' : 'border-transparent'}`}>
                        <AvatarImage src={entry.avatar} />
                        <AvatarFallback>{entry.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      
                      <div className="ml-4 flex-1">
                        <p className={`font-semibold ${isCurrentUser ? 'text-purple-700' : 'text-gray-900'}`}>
                          {entry.name} {isCurrentUser && '(Você)'}
                        </p>
                        {rank === 1 && <span className="text-xs text-yellow-600 font-medium">🏆 Líder do Ranking</span>}
                      </div>
                      
                      <div className="text-right">
                        <div className="font-bold text-gray-900 text-lg">{entry.points}</div>
                        <div className="text-xs text-gray-500">pontos</div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageTransition>
  );
}

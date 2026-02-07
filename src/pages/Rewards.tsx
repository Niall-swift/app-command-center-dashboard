import React, { useState, useEffect } from 'react';
import PageTransition from '@/components/PageTransition';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trophy, Gift, History, Star, ArrowRight, Loader2, Sparkles } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { rewardsService } from '@/services/rewardsService';
import { pointsService } from '@/services/pointsService';
import { Reward, RedeemedReward } from '@/types/rewards';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { motion } from 'framer-motion';

export default function Rewards() {
  const { userData, user } = useAuth();
  const { toast } = useToast();
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [redemptions, setRedemptions] = useState<RedeemedReward[]>([]);
  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{open: boolean, reward: Reward | null}>({
    open: false,
    reward: null
  });

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [rewardsData, redemptionsData] = await Promise.all([
        rewardsService.getAvailableRewards(),
        rewardsService.getUserRedemptions(user.uid)
      ]);
      setRewards(rewardsData);
      setRedemptions(redemptionsData);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const handleRedeemClick = (reward: Reward) => {
    setConfirmDialog({ open: true, reward });
  };

  const handleConfirmRedeem = async () => {
    const reward = confirmDialog.reward;
    if (!reward || !user) return;

    setRedeeming(reward.id);
    try {
      await rewardsService.redeemReward(user.uid, reward.id);
      
      // Atualizar saldo localmente para feedback instantâneo (será atualizado pelo contexto depois)
      // Mas melhor recarregar tudo
      await fetchData();
      
      // Atualizar pontos no contexto seria ideal, mas fetchData pega o histórico atualizado
      // O AuthContext deve atualizar o saldo periodicamente ou podemos forçar
      
      toast({
        title: 'Recompensa resgatada!',
        description: `Você resgatou "${reward.name}" com sucesso.`,
      });
      setConfirmDialog({ open: false, reward: null });
    } catch (error) {
      toast({
        title: 'Erro no resgate',
        description: error instanceof Error ? error.message : 'Não foi possível resgatar.',
        variant: 'destructive',
      });
    } finally {
      setRedeeming(null);
    }
  };

  const userPoints = userData?.points || 0;

  return (
    <PageTransition>
      <div className="space-y-8 pb-10">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Header & Balance Card */}
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Minhas Recompensas</h1>
            <p className="text-gray-600 mb-6">Troque seus pontos por benefícios exclusivos</p>
            
            <Card className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white border-0 shadow-xl overflow-hidden relative">
              <div className="absolute top-0 right-0 p-8 opacity-10">
                <Trophy size={150} />
              </div>
              <CardContent className="p-8 relative z-10">
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-3 bg-white/20 rounded-full backdrop-blur-sm">
                    <Star className="w-8 h-8 text-yellow-300 fill-yellow-300" />
                  </div>
                  <div>
                    <p className="text-purple-100 font-medium">Seu Saldo Atual</p>
                    <h2 className="text-4xl font-bold">{userPoints} pts</h2>
                  </div>
                </div>
                <div className="flex gap-3 mt-6">
                  <Button variant="secondary" className="bg-white/90 hover:bg-white text-purple-700 border-0">
                    <History className="w-4 h-4 mr-2" />
                    Histórico
                  </Button>
                  <Button variant="ghost" className="text-white hover:bg-white/20 hover:text-white">
                    Como ganhar mais?
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Stats / Quick Info */}
          <div className="w-full md:w-80 space-y-4">
            <Card>
              <CardContent className="p-6 flex items-center gap-4">
                <div className="p-3 bg-green-100 text-green-600 rounded-full">
                  <Gift className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Resgates Feitos</p>
                  <p className="text-2xl font-bold">{redemptions.length}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6 flex items-center gap-4">
                <div className="p-3 bg-blue-100 text-blue-600 rounded-full">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Próximo Nível</p>
                  <p className="text-2xl font-bold">Em breve</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Rewards Grid */}
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Gift className="w-5 h-5 text-purple-600" />
            Recompensas Disponíveis
          </h2>
          
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
            </div>
          ) : rewards.length === 0 ? (
            <Card className="bg-gray-50 border-dashed">
              <CardContent className="p-10 text-center text-gray-500">
                <Gift className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Nenhuma recompensa disponível no momento.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {rewards.map((reward) => {
                const canAfford = userPoints >= reward.pointsCost;
                return (
                  <motion.div
                    key={reward.id}
                    whileHover={{ y: -5 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    <Card className={`h-full flex flex-col overflow-hidden ${!canAfford ? 'opacity-80' : ''}`}>
                      <div className={`h-2 w-full ${
                        reward.type === 'discount' ? 'bg-pink-500' :
                        reward.type === 'upgrade' ? 'bg-blue-500' :
                        reward.type === 'premium' ? 'bg-yellow-500' :
                        reward.type === 'product' ? 'bg-green-600' :
                        'bg-indigo-500'
                      }`} />
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-start mb-2">
                          <Badge variant="outline" className="capitalize">
                            {reward.type === 'discount' ? 'Desconto' :
                             reward.type === 'upgrade' ? 'Upgrade' :
                             reward.type === 'premium' ? 'Premium' : 
                             reward.type === 'product' ? 'Produto' : 'Crédito'}
                          </Badge>
                          {reward.stock !== undefined && (
                            <span className="text-xs text-gray-500">Restam: {reward.stock}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-3xl bg-gray-100 w-14 h-14 flex items-center justify-center rounded-xl shadow-inner">
                            {reward.imageUrl ? (
                              <img src={reward.imageUrl} alt={reward.name} className="w-full h-full object-cover rounded-xl" />
                            ) : (
                              reward.icon
                            )}
                          </div>
                          <CardTitle className="text-lg leading-tight">{reward.name}</CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent className="flex-1 flex flex-col">
                        <CardDescription className="mb-4 flex-1">
                          {reward.description}
                        </CardDescription>
                        
                        <div className="mt-auto pt-4 border-t flex items-center justify-between">
                          <div className="font-bold text-purple-700">
                            {reward.pointsCost} <span className="text-xs font-normal text-gray-500">pontos</span>
                          </div>
                          <Button 
                            size="sm" 
                            disabled={!canAfford || (reward.stock !== undefined && reward.stock <= 0)}
                            onClick={() => handleRedeemClick(reward)}
                            className={canAfford ? "bg-purple-600 hover:bg-purple-700" : ""}
                          >
                            Resgatar
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* Confirmation Dialog */}
        <Dialog open={confirmDialog.open} onOpenChange={(open) => !open && setConfirmDialog({ open: false, reward: null })}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirmar Resgate</DialogTitle>
              <DialogDescription>
                Você deseja gastar <strong>{confirmDialog.reward?.pointsCost} pontos</strong> para resgatar:
                <br />
                <span className="font-bold text-gray-900 mt-2 block text-lg">{confirmDialog.reward?.name}</span>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmDialog({ open: false, reward: null })}>
                Cancelar
              </Button>
              <Button onClick={handleConfirmRedeem} disabled={!!redeeming} className="bg-purple-600 hover:bg-purple-700">
                {redeeming ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Confirmar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

         {/* Redemption History */}
         {redemptions.length > 0 && (
          <div className="mt-10">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <History className="w-5 h-5 text-gray-500" />
              Histórico de Resgates
            </h2>
            <div className="bg-white rounded-lg border shadow-sm divide-y">
              {redemptions.map((redemption) => (
                <div key={redemption.id} className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{redemption.rewardName}</p>
                    <p className="text-sm text-gray-500">
                      {redemption.redeemedAt?.toLocaleDateString()} às {redemption.redeemedAt?.toLocaleTimeString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                     <div className="text-right mr-4">
                        <span className="text-xs text-gray-400 block">Código</span>
                        <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono font-bold">{redemption.code}</code>
                     </div>
                    <Badge variant={
                      redemption.status === 'approved' ? 'default' :
                      redemption.status === 'applied' ? 'secondary' :
                      redemption.status === 'expired' ? 'destructive' : 'outline'
                    }>
                      {redemption.status === 'approved' ? 'Aprovado' :
                       redemption.status === 'applied' ? 'Utilizado' :
                       redemption.status === 'expired' ? 'Expirado' : 'Pendente'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </PageTransition>
  );
}

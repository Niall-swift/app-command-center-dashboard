import { 
  collection, 
  getDocs, 
  getDoc,
  doc, 
  addDoc, 
  query, 
  where,
  orderBy, 
  serverTimestamp,
  runTransaction 
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { Reward, RedeemedReward } from '../types/rewards';
import { pointsService } from './pointsService';

const REWARDS_COLLECTION = 'rewards';
const REDEMPTIONS_COLLECTION = 'redeemedRewards';
const USERS_COLLECTION = 'users';

export const rewardsService = {
  // Listar recompensas disponíveis
  getAvailableRewards: async (): Promise<Reward[]> => {
    try {
      const q = query(
        collection(db, REWARDS_COLLECTION),
        where('active', '==', true),
        orderBy('pointsCost', 'asc')
      );
      
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Reward[];
    } catch (error) {
      console.error('Erro ao buscar recompensas:', error);
      return [];
    }
  },

  // Resgatar recompensa
  redeemReward: async (userId: string, rewardId: string): Promise<string> => {
    try {
      // Usar transação para garantir consistência
      return await runTransaction(db, async (transaction) => {
        // 1. Buscar a recompensa
        const rewardRef = doc(db, REWARDS_COLLECTION, rewardId);
        const rewardDoc = await transaction.get(rewardRef);

        if (!rewardDoc.exists()) {
          throw new Error('Recompensa não encontrada');
        }

        const reward = rewardDoc.data() as Reward;
        
        if (!reward.active) {
          throw new Error('Recompensa não está mais ativa');
        }

        if (reward.stock !== undefined && reward.stock <= 0) {
          throw new Error('Estoque esgotado');
        }

        // 2. Buscar usuário para verificar pontos
        const userRef = doc(db, USERS_COLLECTION, userId);
        const userDoc = await transaction.get(userRef);
        
        if (!userDoc.exists()) {
          throw new Error('Usuário não encontrado');
        }

        const userPoints = userDoc.data().points || 0;

        if (userPoints < reward.pointsCost) {
          throw new Error(`Saldo insuficiente. Necessário: ${reward.pointsCost}, Atual: ${userPoints}`);
        }

        // 3. Debitar pontos e decrementar estoque
        transaction.update(userRef, {
          points: userPoints - reward.pointsCost
        });

        if (reward.stock !== undefined) {
          transaction.update(rewardRef, {
            stock: reward.stock - 1
          });
        }

        // 4. Criar registro de resgate
        const redemptionRef = doc(collection(db, REDEMPTIONS_COLLECTION));
        const code = Math.random().toString(36).substring(2, 10).toUpperCase();

        const newRedemption: Omit<RedeemedReward, 'id'> = {
          userId,
          rewardId,
          rewardName: reward.name,
          pointsSpent: reward.pointsCost,
          status: 'pending',
          code,
          redeemedAt: serverTimestamp(),
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 dias de validade
        };

        transaction.set(redemptionRef, newRedemption);
        
        // Também registrar no histórico de pontos
        const historyRef = doc(collection(db, 'pointsHistory'));
        transaction.set(historyRef, {
          userId,
          amount: reward.pointsCost,
          type: 'spend',
          reason: `Resgate: ${reward.name}`,
          createdAt: serverTimestamp()
        });

        return code;
      });
    } catch (error) {
      console.error('Erro ao resgatar recompensa:', error);
      throw error;
    }
  },

  // Histórico de resgates do usuário
  getUserRedemptions: async (userId: string): Promise<RedeemedReward[]> => {
    try {
      const q = query(
        collection(db, REDEMPTIONS_COLLECTION),
        where('userId', '==', userId),
        orderBy('redeemedAt', 'desc')
      );
      
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        // Converter timestamps
        redeemedAt: doc.data().redeemedAt?.toDate(),
        expiresAt: doc.data().expiresAt?.toDate(),
        appliedAt: doc.data().appliedAt?.toDate(),
      })) as RedeemedReward[];
    } catch (error) {
      console.error('Erro ao buscar resgates:', error);
      return [];
    }
  }
};

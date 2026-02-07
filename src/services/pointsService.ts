import { 
  collection, 
  doc, 
  getDoc, 
  updateDoc, 
  increment, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  getDocs,
  serverTimestamp,
  runTransaction
} from 'firebase/firestore';
import { db } from '../config/firebase';

const USERS_COLLECTION = 'users';
const POINTS_HISTORY_COLLECTION = 'pointsHistory';

export interface PointsTransaction {
  id?: string;
  userId: string;
  amount: number;
  type: 'earn' | 'spend';
  reason: string;
  createdAt: any;
}

export const pointsService = {
  // Adicionar pontos a um usuário
  addPoints: async (userId: string, amount: number, reason: string): Promise<void> => {
    try {
      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, USERS_COLLECTION, userId);
        const userDoc = await transaction.get(userRef);

        if (!userDoc.exists()) {
          throw new Error('Usuário não encontrado');
        }

        // Atualizar saldo do usuário
        transaction.update(userRef, {
          points: increment(amount)
        });

        // Registrar histórico
        const historyRef = doc(collection(db, POINTS_HISTORY_COLLECTION));
        transaction.set(historyRef, {
          userId,
          amount,
          type: 'earn',
          reason,
          createdAt: serverTimestamp()
        });
      });
    } catch (error) {
      console.error('Erro ao adicionar pontos:', error);
      throw error;
    }
  },

  // Gastar pontos
  spendPoints: async (userId: string, amount: number, reason: string): Promise<void> => {
    try {
      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, USERS_COLLECTION, userId);
        const userDoc = await transaction.get(userRef);

        if (!userDoc.exists()) {
          throw new Error('Usuário não encontrado');
        }

        const currentPoints = userDoc.data().points || 0;
        if (currentPoints < amount) {
          throw new Error('Saldo insuficiente');
        }

        // Atualizar saldo
        transaction.update(userRef, {
          points: increment(-amount)
        });

        // Registrar histórico
        const historyRef = doc(collection(db, POINTS_HISTORY_COLLECTION));
        transaction.set(historyRef, {
          userId,
          amount,
          type: 'spend',
          reason,
          createdAt: serverTimestamp()
        });
      });
    } catch (error) {
      console.error('Erro ao gastar pontos:', error);
      throw error;
    }
  },

  // Obter saldo atual
  getPointsBalance: async (userId: string): Promise<number> => {
    try {
      const userDoc = await getDoc(doc(db, USERS_COLLECTION, userId));
      if (userDoc.exists()) {
        return userDoc.data().points || 0;
      }
      return 0;
    } catch (error) {
      console.error('Erro ao obter saldo de pontos:', error);
      return 0;
    }
  },

  // Obter histórico de pontos
  getPointsHistory: async (userId: string): Promise<PointsTransaction[]> => {
    try {
      const q = query(
        collection(db, POINTS_HISTORY_COLLECTION),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc')
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PointsTransaction[];
    } catch (error) {
      console.error('Erro ao obter histórico de pontos:', error);
      return [];
    }
  },

  // Verificar e conceder bônus de primeiro login
  giveFirstLoginBonus: async (userId: string): Promise<void> => {
    const BONUS_AMOUNT = 10;
    const BONUS_REASON = 'Bônus de primeiro login';

    // Verificar se já recebeu (usando histórico)
    const q = query(
      collection(db, POINTS_HISTORY_COLLECTION),
      where('userId', '==', userId),
      where('reason', '==', BONUS_REASON)
    );
    
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      await pointsService.addPoints(userId, BONUS_AMOUNT, BONUS_REASON);
    }
  }
};

import { 
  collection, 
  query, 
  orderBy, 
  limit, 
  getDocs, 
  where, 
  getDoc,
  doc
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { User } from '../types/rewards';

const USERS_COLLECTION = 'users';

export interface LeaderboardEntry {
  userId: string;
  name: string;
  points: number;
  rank?: number;
  avatar?: string;
}

export const leaderboardService = {
  // Obter top X usuários
  getLeaderboard: async (limitCount: number = 10): Promise<LeaderboardEntry[]> => {
    try {
      const q = query(
        collection(db, USERS_COLLECTION),
        orderBy('points', 'desc'),
        limit(limitCount)
      );
      
      const snapshot = await getDocs(q);
      
      return snapshot.docs.map((doc, index) => ({
        userId: doc.id,
        name: doc.data().name || 'Usuário',
        points: doc.data().points || 0,
        avatar: doc.data().avatarUrl || undefined,
        rank: index + 1
      }));
    } catch (error) {
      console.error('Erro ao obter leaderboard:', error);
      return [];
    }
  },

  // Obter posição do usuário
  getUserRank: async (userId: string): Promise<number> => {
    try {
      const userRef = doc(db, USERS_COLLECTION, userId);
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) return 0;
      
      const userPoints = userDoc.data().points || 0;
      
      // Contar quantos usuários têm mais pontos
      const q = query(
        collection(db, USERS_COLLECTION),
        where('points', '>', userPoints)
      );
      
      const snapshot = await getDocs(q);
      return snapshot.size + 1;
    } catch (error) {
      console.error('Erro ao obter rank do usuário:', error);
      return 0;
    }
  },

  // Atualizar estatísticas (se necessário, ou apenas deixar dinâmico)
  // No Firestore, queries complexas podem ser caras, então talvez valha a pena cachear o leaderboard
  // Mas para MVP, query direta é aceitável.
};

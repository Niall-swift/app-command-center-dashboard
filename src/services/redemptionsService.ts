import { 
  collection, 
  getDocs, 
  updateDoc, 
  doc, 
  query, 
  orderBy,
  where,
  getDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { RedeemedReward, User } from '../types/rewards';

const REDEMPTIONS_COLLECTION = 'redeemedRewards';
const USERS_COLLECTION = 'users';

export const redemptionsService = {
  // Listar todos os resgates
  getAllRedemptions: async (): Promise<RedeemedReward[]> => {
    try {
      // Ordenar por data de resgate decrescente (mais recentes primeiro)
      const q = query(
        collection(db, REDEMPTIONS_COLLECTION), 
        orderBy('redeemedAt', 'desc')
      );
      
      const snapshot = await getDocs(q);
      
      // Carregar dados dos usuários para cada resgate
      // (Em produção, seria melhor ter uma cloud function que copia dados do user para o documento de resgate)
      const redemptionsWithStringDates = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          // Converter Timestamps para objetos Date ou strings para evitar erros no React
          redeemedAt: data.redeemedAt?.toDate ? data.redeemedAt.toDate() : data.redeemedAt,
          expiresAt: data.expiresAt?.toDate ? data.expiresAt.toDate() : data.expiresAt,
          appliedAt: data.appliedAt?.toDate ? data.appliedAt.toDate() : data.appliedAt,
        };
      }) as RedeemedReward[];

      // Enriquecer com dados do usuário
      const redemptionsWithUsers = await Promise.all(
        redemptionsWithStringDates.map(async (redemption) => {
          try {
            if (!redemption.userId) return redemption;
            const userDoc = await getDoc(doc(db, USERS_COLLECTION, redemption.userId));
            if (userDoc.exists()) {
              const userData = userDoc.data() as User;
              return {
                ...redemption,
                userName: userData.name || 'Usuário sem nome',
                userEmail: userData.email || 'Sem email'
              };
            }
            return redemption;
          } catch (e) {
            console.error(`Error fetching user for redemption ${redemption.id}:`, e);
            return redemption;
          }
        })
      );
      
      return redemptionsWithUsers;
    } catch (error) {
      console.error('Error fetching redemptions:', error);
      throw error;
    }
  },

  // Atualizar status do pedido
  updateStatus: async (
    id: string, 
    status: 'pending' | 'approved' | 'applied' | 'expired'
  ): Promise<void> => {
    try {
      const docRef = doc(db, REDEMPTIONS_COLLECTION, id);
      const updateData: any = { status };
      
      if (status === 'applied') {
        updateData.appliedAt = serverTimestamp();
      }
      
      await updateDoc(docRef, updateData);
    } catch (error) {
      console.error('Error updating redemption status:', error);
      throw error;
    }
  }
};

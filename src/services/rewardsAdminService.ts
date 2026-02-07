import { 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp,
  query,
  orderBy
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { Reward } from '../types/rewards';

const COLLECTION_NAME = 'rewards';

export const rewardsAdminService = {
  // Listar todas as recompensas
  getAllRewards: async (): Promise<Reward[]> => {
    try {
      const q = query(collection(db, COLLECTION_NAME), orderBy('pointsCost', 'asc'));
      const snapshot = await getDocs(q);
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Reward));
    } catch (error) {
      console.error('Error fetching rewards:', error);
      throw error;
    }
  },

  // Criar nova recompensa
  createReward: async (rewardData: Omit<Reward, 'id'>): Promise<string> => {
    try {
      const docRef = await addDoc(collection(db, COLLECTION_NAME), {
        ...rewardData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        active: true // Default to active
      });
      return docRef.id;
    } catch (error) {
      console.error('Error creating reward:', error);
      throw error;
    }
  },

  // Atualizar recompensa
  updateReward: async (id: string, data: Partial<Reward>): Promise<void> => {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      await updateDoc(docRef, {
        ...data,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error updating reward:', error);
      throw error;
    }
  },

  // Deletar recompensa (soft delete preferível, mas aqui vamos permitir delete real por enquanto)
  deleteReward: async (id: string): Promise<void> => {
    try {
      await deleteDoc(doc(db, COLLECTION_NAME, id));
    } catch (error) {
      console.error('Error deleting reward:', error);
      throw error;
    }
  },

  // Alternar status ativo/inativo
  toggleStatus: async (id: string, currentStatus: boolean): Promise<void> => {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      await updateDoc(docRef, {
        active: !currentStatus,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error toggling reward status:', error);
      throw error;
    }
  }
};

import { 
  collection, 
  getDocs, 
  updateDoc, 
  doc, 
  query, 
  orderBy,
  where,
  addDoc,
  deleteDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../config/firebase';

export interface Winner {
  id: string;
  cpf: string;
  name: string;
  prize: string;
  rescueCode: string;
  redeemed: boolean;
  createdAt: any;
  redeemedAt?: any;
}

export interface Raffle {
  id: string;
  title: string;
  status: string; // "SORTEIO ATIVO" | "EM BREVE"
  value: string; // e.g. "Grátis para Membros" | "Plano Gold"
  date: string; // e.g. "TODO SÁBADO" | "DEZEMBRO"
  icon?: string;
  createdAt: any;
}

export const preMixService = {
  // Criar um novo vencedor
  saveWinner: async (winnerData: Omit<Winner, 'id' | 'createdAt' | 'redeemed'>): Promise<string> => {
    try {
      const docRef = await addDoc(collection(db, 'winners'), {
        ...winnerData,
        redeemed: false,
        createdAt: serverTimestamp()
      });
      return docRef.id;
    } catch (error) {
      console.error('Error saving winner:', error);
      throw error;
    }
  },

  // Listar vencedores (não resgatados primeiro)
  getWinners: async (): Promise<Winner[]> => {
    try {
      const q = query(
        collection(db, 'winners'), 
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate ? doc.data().createdAt.toDate() : doc.data().createdAt,
        redeemedAt: doc.data().redeemedAt?.toDate ? doc.data().redeemedAt.toDate() : doc.data().redeemedAt,
      })) as Winner[];
    } catch (error) {
      console.error('Error fetching winners:', error);
      throw error;
    }
  },

  // Marcar como resgatado
  markAsRedeemed: async (id: string): Promise<void> => {
    try {
      const docRef = doc(db, 'winners', id);
      await updateDoc(docRef, {
        redeemed: true,
        redeemedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error marking as redeemed:', error);
      throw error;
    }
  },

  // --- Gestão de Sorteios ---

  getRaffles: async (): Promise<Raffle[]> => {
    try {
      const q = query(collection(db, 'sorteiosPreMix'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate ? doc.data().createdAt.toDate() : doc.data().createdAt,
      })) as Raffle[];
    } catch (error) {
      console.error('Error fetching raffles:', error);
      throw error;
    }
  },

  addRaffle: async (raffle: Omit<Raffle, 'id' | 'createdAt'>): Promise<string> => {
    try {
      const docRef = await addDoc(collection(db, 'sorteiosPreMix'), {
        ...raffle,
        createdAt: serverTimestamp()
      });
      return docRef.id;
    } catch (error) {
      console.error('Error adding raffle:', error);
      throw error;
    }
  },

  deleteRaffle: async (id: string): Promise<void> => {
    try {
      await deleteDoc(doc(db, 'sorteiosPreMix', id));
    } catch (error) {
      console.error('Error deleting raffle:', error);
      throw error;
    }
  }
};

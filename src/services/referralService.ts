import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  query, 
  where, 
  getDocs,
  serverTimestamp,
  updateDoc,
  arrayUnion
} from 'firebase/firestore';
import { db } from '../config/firebase';

const REFERRAL_CODES_COLLECTION = 'referralCodes';
const USERS_COLLECTION = 'users';

export interface ReferralCode {
  code: string;
  userId: string;
  createdAt: any;
  usageCount: number;
}

export const referralService = {
  // Gerar código único de indicação
  generateReferralCode: async (userId: string): Promise<string> => {
    // Tenta usar o nome do usuário + números aleatórios
    // Por simplicidade, vamos gerar algo aleatório por enquanto
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    const length = 8;
    for (let i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    
    // Verificar se já existe
    const codeRef = doc(db, REFERRAL_CODES_COLLECTION, result);
    const codeDoc = await getDoc(codeRef);
    
    if (codeDoc.exists()) {
      return referralService.generateReferralCode(userId); // Tentar novamente em caso de colisão
    }
    
    // Salvar novo código
    await setDoc(codeRef, {
      code: result,
      userId,
      createdAt: serverTimestamp(),
      usageCount: 0
    });

    // Vincular ao usuário
    await updateDoc(doc(db, USERS_COLLECTION, userId), {
      referralCode: result
    });

    return result;
  },

  // Validar código de indicação
  validateReferralCode: async (code: string): Promise<boolean> => {
    if (!code) return false;
    const codeRef = doc(db, REFERRAL_CODES_COLLECTION, code.toUpperCase());
    const codeDoc = await getDoc(codeRef);
    return codeDoc.exists();
  },

  // Processar uso do código de indicação (quando um novo usuário se cadastra)
  processReferralUse: async (code: string, newUserId: string): Promise<string | null> => {
    try {
      if (!code) return null;
      
      const codeRef = doc(db, REFERRAL_CODES_COLLECTION, code.toUpperCase());
      const codeDoc = await getDoc(codeRef);
      
      if (!codeDoc.exists()) {
        return null;
      }
      
      const referrerId = codeDoc.data().userId;
      
      // Não permitir auto-indicação
      if (referrerId === newUserId) return null;

      // Atualizar contagem de uso
      await updateDoc(codeRef, {
        usageCount: (codeDoc.data().usageCount || 0) + 1
      });

      // Vincular novo usuário ao indicador
      await updateDoc(doc(db, USERS_COLLECTION, newUserId), {
        referredBy: referrerId,
        referredAt: serverTimestamp()
      });

      // Adicionar à lista de indicados do indicador
      await updateDoc(doc(db, USERS_COLLECTION, referrerId), {
        referrals: arrayUnion(newUserId)
      });

      return referrerId;
    } catch (error) {
      console.error('Erro ao processar indicação:', error);
      return null;
    }
  },
  
  // Obter código do usuário
  getUserReferralCode: async (userId: string): Promise<string | null> => {
    const userDoc = await getDoc(doc(db, USERS_COLLECTION, userId));
    if (userDoc.exists()) {
      return userDoc.data().referralCode || null;
    }
    return null;
  }
};

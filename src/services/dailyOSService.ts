import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '@/config/firebase';
import type { DailyOSOrder, DailyOSTrackingData } from '@/types/ispfy';

const COLLECTION_NAME = 'os_daily_tracking';
const LOCAL_STORAGE_PREFIX = 'avl_os_daily_v1_';

/**
 * Retorna a data no fuso horário do Brasil (America/Sao_Paulo) no formato YYYY-MM-DD.
 * Isso garante que à meia-noite (00:00) a contagem seja reiniciada automaticamente.
 */
export const getBrazilDateStr = (date: Date = new Date()): string => {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(date); // Ex: '2026-10-15'
  } catch {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
};

/**
 * Retorna a data formatada no padrão brasileiro: DD/MM/YYYY.
 */
export const getBrazilDateFormatted = (date: Date = new Date()): string => {
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date);
  } catch {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${d}/${m}/${y}`;
  }
};

/**
 * Retorna o horário formatado no padrão brasileiro: HH:mm.
 */
export const getBrazilTimeFormatted = (date: Date = new Date()): string => {
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  } catch {
    const h = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return `${h}:${min}`;
  }
};

/**
 * Formata o número sequencial diário (ex: 1 -> "01", 12 -> "12").
 */
export const formatDailyNumber = (n: number): string => {
  if (n <= 0) return '01';
  return String(n).padStart(2, '0');
};

class DailyOSService {
  /**
   * Obtém os dados locais do localStorage para a data fornecida.
   */
  private getLocalData(dateStr: string): DailyOSTrackingData {
    try {
      const stored = localStorage.getItem(`${LOCAL_STORAGE_PREFIX}${dateStr}`);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Erro ao ler localStorage de O.S. diárias:', e);
    }

    const [y, m, d] = dateStr.split('-');
    const formattedDate = d && m && y ? `${d}/${m}/${y}` : getBrazilDateFormatted();

    return {
      date: dateStr,
      formattedDate,
      count: 0,
      orders: [],
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Salva os dados no localStorage como cache imediato e redundância.
   */
  private saveLocalData(dateStr: string, data: DailyOSTrackingData): void {
    try {
      localStorage.setItem(`${LOCAL_STORAGE_PREFIX}${dateStr}`, JSON.stringify(data));
    } catch (e) {
      console.warn('Erro ao salvar localStorage de O.S. diárias:', e);
    }
  }

  /**
   * Obtém a contagem e as O.S. do dia atual (Firestore com fallback para localStorage).
   */
  async getTodayData(): Promise<DailyOSTrackingData> {
    const todayStr = getBrazilDateStr();
    const fallback = this.getLocalData(todayStr);

    try {
      const docRef = doc(db, COLLECTION_NAME, todayStr);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const firestoreData = docSnap.data() as Partial<DailyOSTrackingData>;
        const merged: DailyOSTrackingData = {
          date: todayStr,
          formattedDate: firestoreData.formattedDate || fallback.formattedDate,
          count: typeof firestoreData.count === 'number' ? firestoreData.count : fallback.count,
          orders: Array.isArray(firestoreData.orders) ? firestoreData.orders : fallback.orders,
          lastUpdated: firestoreData.lastUpdated || new Date().toISOString(),
        };
        this.saveLocalData(todayStr, merged);
        return merged;
      } else {
        return fallback;
      }
    } catch (error) {
      console.warn('[DailyOSService] Erro ao carregar do Firestore, usando dados locais:', error);
      return fallback;
    }
  }

  /**
   * Obtém o próximo número de O.S. do dia (ex: 1 se for a primeira do dia, 2 se já tiver 1).
   */
  async getNextDailyNumber(): Promise<{ dailyNumber: number; formattedDailyNumber: string }> {
    const todayData = await this.getTodayData();
    const nextNum = todayData.count + 1;
    return {
      dailyNumber: nextNum,
      formattedDailyNumber: formatDailyNumber(nextNum),
    };
  }

  /**
   * Registra uma nova O.S. aberta no dia.
   * Incrementa a contagem diária e salva o registro segmentado no Firestore e localStorage.
   */
  async registerNewOS(
    orderInput: {
      ticketId: string;
      clientName: string;
      clientId?: string;
      phone?: string;
      plan?: string;
      subject: string;
      priority: string;
      address?: string;
      referencePoint?: string;
      observation?: string;
      wifiSsid?: string;
      wifiPassword?: string;
      whatsappSent?: boolean;
      whatsappGroup?: string;
      fullMessage?: string;
    }
  ): Promise<{ dailyNumber: number; formattedDailyNumber: string; order: DailyOSOrder }> {
    const now = new Date();
    const dateStr = getBrazilDateStr(now);
    const timeStr = getBrazilTimeFormatted(now);
    const formattedDate = getBrazilDateFormatted(now);

    // Carrega dados mais recentes
    const currentData = await this.getTodayData();
    const newDailyNumber = (currentData.count || 0) + 1;
    const formattedDaily = formatDailyNumber(newDailyNumber);

    const newOrder: DailyOSOrder = {
      id: `${dateStr}_${newDailyNumber}_${orderInput.ticketId || Date.now()}`,
      dailyNumber: newDailyNumber,
      formattedDailyNumber: formattedDaily,
      ticketId: orderInput.ticketId,
      clientId: orderInput.clientId,
      clientName: orderInput.clientName,
      phone: orderInput.phone,
      plan: orderInput.plan,
      subject: orderInput.subject,
      priority: orderInput.priority,
      address: orderInput.address,
      referencePoint: orderInput.referencePoint,
      observation: orderInput.observation,
      wifiSsid: orderInput.wifiSsid,
      wifiPassword: orderInput.wifiPassword,
      createdAt: now.toISOString(),
      timeStr,
      dateStr,
      whatsappSent: orderInput.whatsappSent ?? false,
      whatsappGroup: orderInput.whatsappGroup,
      fullMessage: orderInput.fullMessage,
    };

    const updatedOrders = [newOrder, ...currentData.orders.filter(o => o.dailyNumber !== newDailyNumber)];
    // Ordena decrescente por dailyNumber
    updatedOrders.sort((a, b) => b.dailyNumber - a.dailyNumber);

    const updatedData: DailyOSTrackingData = {
      date: dateStr,
      formattedDate,
      count: newDailyNumber,
      orders: updatedOrders,
      lastUpdated: now.toISOString(),
    };

    // 1. Salva localmente de imediato
    this.saveLocalData(dateStr, updatedData);

    // 2. Persiste no Firestore
    try {
      const docRef = doc(db, COLLECTION_NAME, dateStr);
      await setDoc(docRef, {
        date: dateStr,
        formattedDate,
        count: newDailyNumber,
        orders: updatedOrders,
        lastUpdated: now.toISOString(),
      }, { merge: true });
    } catch (err) {
      console.error('[DailyOSService] Erro ao sincronizar com Firestore:', err);
    }

    return {
      dailyNumber: newDailyNumber,
      formattedDailyNumber: formattedDaily,
      order: newOrder,
    };
  }

  /**
   * Escuta em tempo real as atualizações de O.S. do dia de hoje.
   */
  subscribeTodayData(callback: (data: DailyOSTrackingData) => void): () => void {
    const todayStr = getBrazilDateStr();
    const initial = this.getLocalData(todayStr);
    callback(initial);

    try {
      const docRef = doc(db, COLLECTION_NAME, todayStr);
      const unsubscribe = onSnapshot(
        docRef,
        (snap) => {
          if (snap.exists()) {
            const data = snap.data() as Partial<DailyOSTrackingData>;
            const formattedDate = data.formattedDate || getBrazilDateFormatted();
            const count = typeof data.count === 'number' ? data.count : 0;
            const orders = Array.isArray(data.orders) ? data.orders : [];
            const result: DailyOSTrackingData = {
              date: todayStr,
              formattedDate,
              count,
              orders,
              lastUpdated: data.lastUpdated || new Date().toISOString(),
            };
            this.saveLocalData(todayStr, result);
            callback(result);
          } else {
            callback(this.getLocalData(todayStr));
          }
        },
        (error) => {
          console.warn('[DailyOSService] Snapshot error:', error);
          callback(this.getLocalData(todayStr));
        }
      );
      return unsubscribe;
    } catch (e) {
      console.warn('[DailyOSService] Não foi possível escutar Firestore:', e);
      return () => {};
    }
  }

  /**
   * Obtém histórico segmentado de uma data específica (ex: '2026-10-14').
   */
  async getOrdersByDate(dateStr: string): Promise<DailyOSTrackingData> {
    const fallback = this.getLocalData(dateStr);
    try {
      const docRef = doc(db, COLLECTION_NAME, dateStr);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data() as Partial<DailyOSTrackingData>;
        return {
          date: dateStr,
          formattedDate: data.formattedDate || dateStr,
          count: data.count || 0,
          orders: data.orders || [],
          lastUpdated: data.lastUpdated,
        };
      }
      return fallback;
    } catch {
      return fallback;
    }
  }
}

export const dailyOSService = new DailyOSService();

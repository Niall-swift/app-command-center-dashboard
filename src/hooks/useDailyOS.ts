import { useState, useEffect, useCallback } from 'react';
import { dailyOSService, formatDailyNumber, getBrazilDateStr, getBrazilDateFormatted } from '@/services/dailyOSService';
import type { DailyOSOrder, DailyOSTrackingData } from '@/types/ispfy';

export interface UseDailyOSReturn {
  dateStr: string;
  formattedDate: string;
  count: number;
  nextDailyNumber: number;
  formattedNextDailyNumber: string;
  orders: DailyOSOrder[];
  loading: boolean;
  registerOS: (orderInput: {
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
  }) => Promise<{ dailyNumber: number; formattedDailyNumber: string; order: DailyOSOrder }>;
  refresh: () => Promise<void>;
}

export const useDailyOS = (): UseDailyOSReturn => {
  const [data, setData] = useState<DailyOSTrackingData>(() => ({
    date: getBrazilDateStr(),
    formattedDate: getBrazilDateFormatted(),
    count: 0,
    orders: [],
  }));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = dailyOSService.subscribeTodayData((updatedData) => {
      setData(updatedData);
      setLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const fresh = await dailyOSService.getTodayData();
      setData(fresh);
    } finally {
      setLoading(false);
    }
  }, []);

  const registerOS = useCallback(
    async (orderInput: Parameters<typeof dailyOSService.registerNewOS>[0]) => {
      const result = await dailyOSService.registerNewOS(orderInput);
      // Atualiza o estado local imediatamente
      setData((prev) => ({
        ...prev,
        count: result.dailyNumber,
        orders: [result.order, ...prev.orders.filter(o => o.dailyNumber !== result.dailyNumber)],
      }));
      return result;
    },
    []
  );

  const nextDailyNumber = (data.count || 0) + 1;
  const formattedNextDailyNumber = formatDailyNumber(nextDailyNumber);

  return {
    dateStr: data.date,
    formattedDate: data.formattedDate,
    count: data.count || 0,
    nextDailyNumber,
    formattedNextDailyNumber,
    orders: data.orders || [],
    loading,
    registerOS,
    refresh,
  };
};

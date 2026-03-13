import { useState, useEffect, useCallback } from 'react';
import { ixcService } from '@/services/ixc/ixcService';
import { smartOltService } from '@/services/smartolt/smartOltService';
import type { 
  IXCClienteData, 
  IXCContratoData, 
  IXCFaturaData, 
  IXCLoginData,
  IXCPixData,
  IXCUsageSeries
} from '@/types/ixc';
import type { SmartOltOnu, SmartOltSignal } from '@/types/smartOlt';
import { useToast } from '@/hooks/use-toast';

export interface UseIXCOptions {
  clientId?: string;
  autoLoad?: boolean;
}

export function useIXC({ clientId, autoLoad = true }: UseIXCOptions = {}) {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [client, setClient] = useState<IXCClienteData | null>(null);
  const [contracts, setContracts] = useState<IXCContratoData[]>([]);
  const [invoices, setInvoices] = useState<IXCFaturaData[]>([]);
  const [logins, setLogins] = useState<IXCLoginData[]>([]);
  const [onu, setOnu] = useState<SmartOltOnu | null>(null);
  const [signal, setSignal] = useState<SmartOltSignal | null>(null);
  const [loadingSignal, setLoadingSignal] = useState<boolean>(false);
  const [bandwidthUsage, setBandwidthUsage] = useState<IXCUsageSeries[]>([]);
  const [pendingContracts, setPendingContracts] = useState<IXCContratoData[]>([]);
  const [isEligibleForUnlock, setIsEligibleForUnlock] = useState<boolean>(false);
  const { toast } = useToast();

  const loadClientData = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const [clientData, contractsData, invoicesData, loginsData] = await Promise.all([
        ixcService.getClienteById(id),
        ixcService.getContratosByCliente(id),
        ixcService.getFaturasByCliente(id),
        ixcService.getLoginsByCliente(id)
      ]);

      setClient(clientData);
      setContracts(contractsData);
      setInvoices(invoicesData);
      setLogins(loginsData);

      // Advanced IXC: Buscar contratos pendentes e elegibilidade
      const pendingCont = await ixcService.getPendingContracts(id);
      setPendingContracts(pendingCont);
      
      const eligibility = await ixcService.checkUnlockEligibility(id);
      setIsEligibleForUnlock(eligibility.eligible);

      // SmartOLT & Bandwidth
      if (loginsData.length > 0) {
        const loginId = loginsData[0].id;
        const loginStr = loginsData[0].login;
        
        if (loginId) {
          const usage = await ixcService.getBandwidthUsage(loginId);
          setBandwidthUsage(usage);
        }

        if (loginStr) {
          const onuData = await smartOltService.findOnu(loginStr);
          if (onuData) {
            setOnu(onuData);
            const signalData = await smartOltService.getOnuSignal(onuData.id);
            setSignal(signalData);
          }
        }
      }
    } catch (err: any) {
      const msg = err.message || 'Erro ao carregar dados do IXC';
      setError(msg);
      toast({
        title: 'Erro no IXC',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const updateWifi = async (loginId: string, ssid: string, pass: string) => {
    try {
      const result = await ixcService.updateWifi(loginId, ssid, pass);
      if (result.success) {
        toast({
          title: 'Sucesso',
          description: result.message,
        });
        // Refresh logins
        if (clientId) {
          const freshLogins = await ixcService.getLoginsByCliente(clientId);
          setLogins(freshLogins);
        }
      } else {
        toast({
          title: 'Erro',
          description: result.message,
          variant: 'destructive',
        });
      }
      return result;
    } catch (err: any) {
      toast({
        title: 'Erro',
        description: 'Falha na comunicação com o servidor.',
        variant: 'destructive',
      });
      return { success: false, message: 'Erro de comunicação.' };
    }
  };

  const getPix = async (invoiceId: string): Promise<IXCPixData | null> => {
    try {
      const pix = await ixcService.getPixQrCode(invoiceId);
      if (!pix) {
        toast({
          title: 'Erro',
          description: 'Não foi possível gerar o PIX para esta fatura.',
          variant: 'destructive',
        });
      }
      return pix;
    } catch (err) {
      return null;
    }
  };

  const unlock = async (contractId: string) => {
    try {
      const result = await ixcService.unlockContract(contractId);
      if (result.success) {
        toast({
          title: 'Desbloqueio efetuado',
          description: result.message,
        });
      } else {
        toast({
          title: 'Erro no desbloqueio',
          description: result.message,
          variant: 'destructive',
        });
      }
      return result;
    } catch (err) {
      return { success: false, message: 'Erro ao processar desbloqueio.' };
    }
  };

  const disconnect = async (loginId: string) => {
    try {
      const result = await ixcService.desconectarCliente(loginId);
      if (result.success) {
        toast({
          title: 'Conexão encerrada',
          description: result.message,
        });
        // Refresh logins to show offline status
        if (clientId) {
          const freshLogins = await ixcService.getLoginsByCliente(clientId);
          setLogins(freshLogins);
        }
      } else {
        toast({
          title: 'Erro ao desconectar',
          description: result.message,
          variant: 'destructive',
        });
      }
      return result;
    } catch (err) {
      return { success: false, message: 'Erro ao processar desconexão.' };
    }
  };

  const refreshSignal = async () => {
    if (!onu) return;
    setLoadingSignal(true);
    try {
      const data = await smartOltService.getOnuSignal(onu.id);
      setSignal(data);
    } finally {
      setLoadingSignal(false);
    }
  };

  const rebootOnu = async () => {
    if (!onu) return;
    const result = await smartOltService.rebootOnu(onu.id);
    if (result.success) {
      toast({ title: 'Comando enviado', description: 'ONU reiniciando...' });
    } else {
      toast({ title: 'Erro', description: result.message, variant: 'destructive' });
    }
    return result;
  };

  useEffect(() => {
    if (autoLoad && clientId) {
      loadClientData(clientId);
    }
  }, [clientId, autoLoad, loadClientData]);

  return {
    loading,
    error,
    client,
    contracts,
    invoices,
    logins,
    onu,
    signal,
    loadingSignal,
    bandwidthUsage,
    pendingContracts,
    isEligibleForUnlock,
    refresh: () => clientId && loadClientData(clientId),
    updateWifi,
    getPix,
    unlock,
    disconnect,
    refreshSignal,
    rebootOnu,
  };
}

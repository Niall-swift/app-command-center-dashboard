import { useState, useEffect, useCallback } from 'react';
import { ispfyService as ISPFYService } from '@/services/ispfy/ispfyService';
import { smartOltService } from '@/services/smartolt/smartOltService';
import type { 
  ISPFYClienteData, 
  ISPFYContratoData, 
  ISPFYFaturaData, 
  ISPFYLoginData,
  ISPFYPixData,
  ISPFYUsageSeries,
  ISPFYLivePointStatus,
  ISPFYBandwidthSummary30d,
  ISPFYPlanoTeste
} from '@/types/ispfy';
import type { SmartOltOnu, SmartOltSignal } from '@/types/smartOlt';
import { useToast } from '@/hooks/use-toast';

export interface UseISPFYOptions {
  clientId?: string;
  autoLoad?: boolean;
}

export function useISPFY({ clientId, autoLoad = true }: UseISPFYOptions = {}) {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [client, setClient] = useState<ISPFYClienteData | null>(null);
  const [contracts, setContracts] = useState<ISPFYContratoData[]>([]);
  const [invoices, setInvoices] = useState<ISPFYFaturaData[]>([]);
  const [logins, setLogins] = useState<ISPFYLoginData[]>([]);
  const [livePoints, setLivePoints] = useState<ISPFYLivePointStatus[]>([]);
  const [stationDetails, setStationDetails] = useState<{
    station: Record<string, unknown> | null;
    history: Record<string, unknown>[];
    sessoes: Record<string, unknown>[];
  } | null>(null);
  const [bandwidthSummary, setBandwidthSummary] = useState<ISPFYBandwidthSummary30d | null>(null);
  const [testablePlans, setTestablePlans] = useState<ISPFYPlanoTeste[]>([]);
  const [onu, setOnu] = useState<SmartOltOnu | null>(null);
  const [signal, setSignal] = useState<SmartOltSignal | null>(null);
  const [loadingSignal, setLoadingSignal] = useState<boolean>(false);
  const [bandwidthUsage, setBandwidthUsage] = useState<ISPFYUsageSeries[]>([]);
  const [pendingContracts, setPendingContracts] = useState<ISPFYContratoData[]>([]);
  const [isEligibleForUnlock, setIsEligibleForUnlock] = useState<boolean>(false);
  const { toast } = useToast();

  const loadClientData = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const [clientData, contractsData, invoicesData, loginsData, livePts] = await Promise.all([
        ISPFYService.getClienteById(id),
        ISPFYService.getContratosByCliente(id),
        ISPFYService.getFaturasByCliente(id),
        ISPFYService.getLoginsByCliente(id),
        ISPFYService.getClientLivePointStatuses(id).catch(() => []),
      ]);

      setClient(clientData);
      setContracts(contractsData);
      setInvoices(invoicesData);
      setLogins(loginsData);
      setLivePoints(livePts);

      const pendingCont = await ISPFYService.getPendingContracts(id);
      setPendingContracts(pendingCont);
      
      const eligibility = await ISPFYService.checkUnlockEligibility(id);
      setIsEligibleForUnlock(eligibility.eligible);

      const primaryPointId = livePts[0]?.idPonto || loginsData[0]?.id || '';
      const primaryLoginStr = loginsData[0]?.login;

      if (primaryPointId) {
        const [usage, summary, details, plans] = await Promise.all([
          ISPFYService.getBandwidthUsage(primaryPointId).catch(() => []),
          ISPFYService.getBandwidthSummary30Days(primaryPointId).catch(() => null),
          ISPFYService.getDetalhesConexao(primaryPointId).catch(() => null),
          ISPFYService.getTestablePlans(primaryPointId).catch(() => []),
        ]);
        setBandwidthUsage(usage);
        setBandwidthSummary(summary);
        setStationDetails(details);
        setTestablePlans(plans);
      }

      if (primaryLoginStr) {
        const onuData = await smartOltService.findOnu(primaryLoginStr);
        if (onuData) {
          setOnu(onuData);
          const signalData = await smartOltService.getOnuSignal(onuData.id);
          setSignal(signalData);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao carregar dados do ISPFY';
      setError(msg);
      toast({
        title: 'Erro no ISPFY',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const updateWifi = async (loginId: string, ssid: string, pass: string) => {
    try {
      const result = await ISPFYService.updateWifi(loginId, ssid, pass);
      if (result.success) {
        toast({
          title: 'Sucesso',
          description: result.message,
        });
        // Refresh logins
        if (clientId) {
          const freshLogins = await ISPFYService.getLoginsByCliente(clientId);
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
    } catch {
      toast({
        title: 'Erro',
        description: 'Falha na comunicação com o servidor.',
        variant: 'destructive',
      });
      return { success: false, message: 'Erro de comunicação.' };
    }
  };

  const getPix = async (invoiceId: string): Promise<ISPFYPixData | null> => {
    try {
      const pix = await ISPFYService.getPixQrCode(invoiceId, client?.cpf_cnpj);
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
      const result = await ISPFYService.unlockContract(contractId);
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
      const result = await ISPFYService.desconectarCliente(loginId);
      if (result.success) {
        toast({
          title: 'Conexão encerrada',
          description: result.message,
        });
        // Refresh logins to show offline status
        if (clientId) {
          const freshLogins = await ISPFYService.getLoginsByCliente(clientId);
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

  const activateTurbo = async (idPonto: string, idPlano: string, dataFinal: string) => {
    const result = await ISPFYService.activatePlanTest(idPonto, idPlano, dataFinal);
    if (result.success) {
      toast({ title: 'Turbo ativado!', description: result.message });
      if (clientId) await loadClientData(clientId);
    } else {
      toast({ title: 'Erro ao ativar Turbo', description: result.message, variant: 'destructive' });
    }
    return result;
  };

  const removeTurbo = async (idPonto: string) => {
    const result = await ISPFYService.removePlanTest(idPonto);
    if (result.success) {
      toast({ title: 'Turbo removido', description: result.message });
      if (clientId) await loadClientData(clientId);
    } else {
      toast({ title: 'Erro ao remover Turbo', description: result.message, variant: 'destructive' });
    }
    return result;
  };

  const closeTicket = async (idTicket: string) => {
    const result = await ISPFYService.closeTicket(idTicket);
    if (result.success) {
      toast({ title: 'Chamado encerrado', description: result.message });
    } else {
      toast({ title: 'Erro ao encerrar O.S.', description: result.message, variant: 'destructive' });
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
    livePoints,
    stationDetails,
    bandwidthSummary,
    testablePlans,
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
    activateTurbo,
    removeTurbo,
    closeTicket,
  };
}

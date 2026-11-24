import { useState, useEffect, useCallback } from 'react';
import { ispfyService as ISPFYService } from '@/services/ispfy/ispfyService';
import { smartOltService } from '@/services/smartolt/smartOltService';
import type {
  ISPFYClienteData,
  ISPFYClienteContato,
  ISPFYContratoData,
  ISPFYFaturaData,
  ISPFYLoginData,
  ISPFYPixData,
  ISPFYTicketData,
  ISPFYCarteira,
  ISPFYPlanoData,
  ISPFYUsageSeries,
  ISPFYLivePointStatus,
  ISPFYBandwidthSummary30d,
  ISPFYPlanoTeste,
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
  const [cityName, setCityName] = useState<string>('');
  const [contacts, setContacts] = useState<ISPFYClienteContato[]>([]);
  const [contracts, setContracts] = useState<ISPFYContratoData[]>([]);
  const [invoices, setInvoices] = useState<ISPFYFaturaData[]>([]);
  const [logins, setLogins] = useState<ISPFYLoginData[]>([]);
  const [tickets, setTickets] = useState<ISPFYTicketData[]>([]);
  const [carteiras, setCarteiras] = useState<ISPFYCarteira[]>([]);
  const [planos, setPlanos] = useState<ISPFYPlanoData[]>([]);
  const [pontoPlanos, setPontoPlanos] = useState<Record<string, unknown>[]>([]);
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

  const loadClientData = useCallback(
    async (id: string) => {
      setLoading(true);
      setError(null);
      setOnu(null);
      setSignal(null);

      try {
        const [
          clientData,
          contactsData,
          contractsData,
          invoicesData,
          loginsData,
          ticketsData,
          livePts,
          carteirasData,
          planosData,
        ] = await Promise.all([
          ISPFYService.getClienteById(id),
          ISPFYService.getClienteContatos(id).catch(() => []),
          ISPFYService.getContratosByCliente(id).catch(() => []),
          ISPFYService.getFaturasByCliente(id).catch(() => []),
          ISPFYService.getLoginsByCliente(id).catch(() => []),
          ISPFYService.getTicketsByCliente(id).catch(() => []),
          ISPFYService.getClientLivePointStatuses(id).catch(() => []),
          ISPFYService.getCarteiras().catch(() => []),
          ISPFYService.getPlanosAtivos().catch(() => []),
        ]);

        setClient(clientData);
        setContacts(contactsData as ISPFYClienteContato[]);
        setContracts(contractsData);
        setInvoices(invoicesData);
        setLogins(loginsData);
        setTickets(ticketsData);
        setLivePoints(livePts);
        setCarteiras(carteirasData);
        setPlanos(planosData);

        if (clientData?.cidade) {
          setCityName(String(clientData.cidade));
        } else if (clientData?.endereco_cobranca_id_cidade) {
          ISPFYService.resolveCidadeNome(clientData.endereco_cobranca_id_cidade)
            .then((resolved) => setCityName(resolved))
            .catch(() => setCityName(''));
        } else {
          setCityName('');
        }

        const pendingCont = contractsData.filter(
          (c) => c.assinatura_digital === 'S' && c.contrato_assinado === 'N'
        );
        setPendingContracts(pendingCont);

        const hasBlockedContract = contractsData.some((c) => {
          const st = String(c.status_contrato || c.status_internet || '').toLowerCase();
          return (
            st.includes('bloq') ||
            st.includes('susp') ||
            st === 'fa' ||
            st === 'ca' ||
            st === 'cm' ||
            st === 'ba'
          );
        });
        setIsEligibleForUnlock(hasBlockedContract || contractsData.length > 0);

        const primaryPointId = livePts[0]?.idPonto || loginsData[0]?.id || '';

        if (primaryPointId) {
          const [usage, summary, details, plans, ptPlans] = await Promise.all([
            ISPFYService.getBandwidthUsage(primaryPointId).catch(() => []),
            ISPFYService.getBandwidthSummary30Days(primaryPointId).catch(() => null),
            ISPFYService.getDetalhesConexao(primaryPointId).catch(() => null),
            ISPFYService.getTestablePlans(primaryPointId).catch(() => []),
            ISPFYService.getPontoPlanos(primaryPointId).catch(() => []),
          ]);
          setBandwidthUsage(usage);
          setBandwidthSummary(summary);
          setStationDetails(details);
          setTestablePlans(plans);
          setPontoPlanos(ptPlans);
        } else {
          setBandwidthUsage([]);
          setBandwidthSummary(null);
          setStationDetails(null);
          setTestablePlans([]);
          setPontoPlanos([]);
        }

        const ontPppoeLogins = Array.from(
          new Set(
            [
              ...loginsData.map((l) => l.usuario || l.login),
              ...contractsData.map((c) => c.login),
            ]
              .map((v) => String(v || '').trim())
              .filter((v) => v.length >= 3)
          )
        );
        const ontFullNames = Array.from(
          new Set(
            [clientData?.nome_razao, clientData?.razao, clientData?.nome]
              .map((v) => String(v || '').trim())
              .filter((v) => v.length >= 5 && v.includes(' '))
          )
        );

        if (ontPppoeLogins.length > 0 || ontFullNames.length > 0) {
          const match = await smartOltService
            .findClientOnu({
              pppoeLogins: ontPppoeLogins,
              fullNames: ontFullNames,
              live: false,
            })
            .catch(() => ({ onu: null, candidates: [] }));
          if (match.onu) {
            setOnu(match.onu);
            const signalData = await smartOltService
              .getOnuSignal(match.onu.unique_external_id || match.onu.id)
              .catch(() => null);
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
    },
    [toast]
  );

  const updateWifi = async (loginId: string, ssid: string, pass: string) => {
    try {
      const result = await ISPFYService.updateWifi(loginId, ssid, pass);
      if (result.success) {
        toast({ title: 'Sucesso', description: result.message });
        if (clientId) {
          const freshLogins = await ISPFYService.getLoginsByCliente(clientId);
          setLogins(freshLogins);
        }
      } else {
        toast({ title: 'Erro', description: result.message, variant: 'destructive' });
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

  const getPix = async (
    invoiceId: string,
    invoiceHint?: ISPFYFaturaData | null
  ): Promise<ISPFYPixData | null> => {
    try {
      const pix = await ISPFYService.getPixQrCode(
        invoiceId,
        client?.cpf_cnpj || client?.cnpj_cpf,
        invoiceHint
      );
      if (!pix) {
        toast({
          title: 'PIX indisponível',
          description: 'Não foi possível localizar o PIX ou boleto para esta fatura.',
          variant: 'destructive',
        });
      }
      return pix;
    } catch {
      return null;
    }
  };

  const unlock = async (contractId: string) => {
    try {
      const result = await ISPFYService.unlockContract(contractId);
      if (result.success) {
        toast({ title: 'Liberação efetuada', description: result.message });
        if (clientId) await loadClientData(clientId);
      } else {
        toast({
          title: 'Liberação indisponível',
          description: result.message,
          variant: 'destructive',
        });
      }
      return result;
    } catch {
      return { success: false, message: 'Erro ao processar desbloqueio.' };
    }
  };

  const disconnect = async (loginId: string) => {
    try {
      const result = await ISPFYService.desconectarCliente(loginId);
      if (result.success) {
        toast({ title: 'Conexão encerrada', description: result.message });
        if (clientId) {
          const freshLogins = await ISPFYService.getLoginsByCliente(clientId);
          setLogins(freshLogins);
        }
      } else {
        toast({ title: 'Erro ao desconectar', description: result.message, variant: 'destructive' });
      }
      return result;
    } catch {
      return { success: false, message: 'Erro ao processar desconexão.' };
    }
  };

  const refreshSignal = async () => {
    if (!onu) return;
    setLoadingSignal(true);
    try {
      const data = await smartOltService.getOnuSignal(onu.unique_external_id || onu.id);
      setSignal(data);
    } finally {
      setLoadingSignal(false);
    }
  };

  const rebootOnu = async () => {
    if (!onu) return;
    const result = await smartOltService.rebootOnu(onu.unique_external_id || onu.id);
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
      if (clientId) {
        const fresh = await ISPFYService.getTicketsByCliente(clientId).catch(() => tickets);
        setTickets(fresh);
      }
    } else {
      toast({ title: 'Erro ao encerrar O.S.', description: result.message, variant: 'destructive' });
    }
    return result;
  };

  const refreshTickets = async () => {
    if (!clientId) return;
    const fresh = await ISPFYService.getTicketsByCliente(clientId).catch(() => tickets);
    setTickets(fresh);
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
    cityName,
    contacts,
    contracts,
    invoices,
    logins,
    tickets,
    carteiras,
    planos,
    pontoPlanos,
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
    refreshTickets,
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

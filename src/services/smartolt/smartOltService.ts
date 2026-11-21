import axios, { AxiosInstance } from 'axios';
import { auth } from '@/config/firebase';
import type {
  SmartOltClientMatchResult,
  SmartOltListResponse,
  SmartOltMatchReason,
  SmartOltOlt,
  SmartOltOnu,
  SmartOltOnuDiagnostics,
  SmartOltOpticalRadarResponse,
  SmartOltSignal,
  SmartOltUnconfiguredOnu,
} from '@/types/smartOlt';

const CLOUD_SMARTOLT_PROXY =
  'https://us-central1-avl-telecom.cloudfunctions.net/smartOltProxy';

class SmartOltService {
  private client: AxiosInstance;

  constructor() {
    // Chama diretamente a Cloud Function smartOltProxy (com CORS + validação Firebase Auth Bearer).
    // Funciona em localhost e produção sem depender de restart do proxy Vite e mantendo o token 100% no servidor.
    const baseURL = CLOUD_SMARTOLT_PROXY;

    this.client = axios.create({
      baseURL,
      headers: {
        Accept: 'application/json',
      },
      timeout: 35000,
    });

    this.client.interceptors.request.use(async (config) => {
      try {
        const user = auth.currentUser;
        if (user) {
          const idToken = await user.getIdToken();
          config.headers.Authorization = `Bearer ${idToken}`;
        }
      } catch {
        // segue sem token caso usuário ainda esteja carregando
      }
      return config;
    });
  }

  /**
   * Lista todas as OLTs com saúde (temperatura, voltagem, uptime)
   */
  async getOlts(fresh = false): Promise<SmartOltOlt[]> {
    try {
      const response = await this.client.get<SmartOltListResponse<SmartOltOlt>>('/olts', {
        params: fresh ? { fresh: '1' } : undefined,
      });
      return response.data.olts || [];
    } catch (error) {
      console.error('Erro ao buscar OLTs no SmartOLT:', error);
      return [];
    }
  }

  /**
   * Visão geral completa das OLTs + contagem de ONUs por OLT + não configuradas
   */
  async getOltOverview(fresh = false): Promise<{
    olts: SmartOltOlt[];
    unconfiguredCount: number;
    unconfiguredOnus: SmartOltUnconfiguredOnu[];
  }> {
    const response = await this.client.get<{
      status: boolean;
      olts?: SmartOltOlt[];
      unconfigured_count?: number;
      unconfigured_onus?: SmartOltUnconfiguredOnu[];
    }>('/olt-overview', {
      params: fresh ? { fresh: '1' } : undefined,
    });
    return {
      olts: response.data.olts || [],
      unconfiguredCount: response.data.unconfigured_count || 0,
      unconfiguredOnus: response.data.unconfigured_onus || [],
    };
  }

  /**
   * Lista / pesquisa ONUs no índice em cache do servidor (rápido e econômico em cota)
   */
  async getOnus(params?: { limit?: number; search?: string }): Promise<SmartOltOnu[]> {
    try {
      const response = await this.client.get<SmartOltListResponse<SmartOltOnu>>('/onus', {
        params,
      });
      return response.data.onus || [];
    } catch (error) {
      console.error('Erro ao buscar ONUs no SmartOLT:', error);
      return [];
    }
  }

  /**
   * Busca manual rápida de ONTs por login PPPoE, nome, SN ou porta PON
   */
  async searchOnus(query: string, limit = 20): Promise<SmartOltOnu[]> {
    const q = query.trim();
    if (!q) return [];
    try {
      const response = await this.client.get<SmartOltListResponse<SmartOltOnu>>('/search-onus', {
        params: { q, limit },
      });
      return response.data.onus || [];
    } catch (error) {
      console.error('Erro ao pesquisar ONUs no SmartOLT:', error);
      return [];
    }
  }

  /**
   * Encontra automaticamente a ONT do cliente no servidor (cruza ID salvo, SN, logins PPPoE e nome)
   */
  async findClientOnu(params: {
    onuId?: string;
    sn?: string;
    pppoeLogins?: string[];
    fullNames?: string[];
    queries?: string[];
    live?: boolean;
  }): Promise<SmartOltClientMatchResult> {
    try {
      const cleanList = (arr?: string[]) =>
        Array.from(
          new Set(
            (arr || [])
              .map((q) => String(q || '').trim())
              .filter((q) => q.length >= 3)
          )
        ).slice(0, 8);

      const cleanLogins = cleanList(params.pppoeLogins);
      const cleanFullNames = cleanList(params.fullNames);
      const cleanQueries = cleanList(params.queries);

      if (
        !params.onuId &&
        !params.sn &&
        cleanLogins.length === 0 &&
        cleanFullNames.length === 0 &&
        cleanQueries.length === 0
      ) {
        return {
          onu: null,
          matchScore: 0,
          matchReason: 'none',
          candidates: [],
          liveChecked: false,
        };
      }

      const response = await this.client.get<{
        status: boolean;
        onu: SmartOltOnu | null;
        match_score?: number;
        match_reason?: SmartOltMatchReason;
        candidates?: SmartOltOnu[];
        live_checked?: boolean;
      }>('/find-client-onu', {
        params: {
          ...(params.onuId ? { onuId: params.onuId } : {}),
          ...(params.sn ? { sn: params.sn } : {}),
          ...(cleanLogins.length > 0 ? { logins: cleanLogins.join('||') } : {}),
          ...(cleanFullNames.length > 0 ? { fullNames: cleanFullNames.join('||') } : {}),
          ...(cleanQueries.length > 0 ? { queries: cleanQueries.join('||') } : {}),
          ...(params.live ? { live: '1' } : {}),
        },
      });

      return {
        onu: response.data.onu || null,
        matchScore: response.data.match_score || 0,
        matchReason: response.data.match_reason || 'none',
        candidates: response.data.candidates || [],
        liveChecked: Boolean(response.data.live_checked),
      };
    } catch (error) {
      console.error('Erro ao localizar ONT do cliente:', error);
      return {
        onu: null,
        matchScore: 0,
        matchReason: 'none',
        candidates: [],
        liveChecked: false,
      };
    }
  }

  /**
   * Compatibilidade com hooks legados (useISPFY)
   */
  async findOnu(query: string): Promise<SmartOltOnu | null> {
    const res = await this.findClientOnu({ queries: [query] });
    return res.onu;
  }

  /**
   * Diagnóstico completo de uma ONT (status ao vivo, sinal 1310/1490, histórico 7 dias, perfis, modelo)
   */
  async getOnuDiagnostics(
    onuExternalId: string,
    live = true
  ): Promise<SmartOltOnuDiagnostics | null> {
    try {
      const response = await this.client.get<{
        status: boolean;
        onu: SmartOltOnu;
        details: SmartOltOnuDiagnostics['details'];
        speed_profiles: SmartOltOnuDiagnostics['speed_profiles'];
        history_7d: SmartOltOnuDiagnostics['history_7d'];
      }>(`/onu-diagnostics/${encodeURIComponent(onuExternalId)}`, {
        params: { live: live ? '1' : '0' },
      });

      if (!response.data.status || !response.data.onu) return null;
      return {
        onu: response.data.onu,
        details: response.data.details || null,
        speed_profiles: response.data.speed_profiles || null,
        history_7d: response.data.history_7d || null,
      };
    } catch (error) {
      console.error('Erro ao obter diagnóstico da ONT:', error);
      return null;
    }
  }

  /**
   * Compatibilidade com useISPFY: obtém os níveis de sinal (RX/TX) de uma ONU
   */
  async getOnuSignal(onuExternalId: string): Promise<SmartOltSignal | null> {
    const diag = await this.getOnuDiagnostics(onuExternalId, false);
    if (!diag) return null;
    const rxNum = diag.onu.rx_power_numeric ?? null;
    const oltRxNum = diag.onu.olt_rx_power_numeric ?? null;
    return {
      onu_id: diag.onu.id,
      rx_power: rxNum !== null ? rxNum.toFixed(2) : '--',
      tx_power: oltRxNum !== null ? oltRxNum.toFixed(2) : '--',
      olt_rx_power: oltRxNum !== null ? oltRxNum.toFixed(2) : '--',
      rx_power_numeric: rxNum,
      tx_power_numeric: oltRxNum,
      olt_rx_power_numeric: oltRxNum,
      signal_quality: diag.onu.signal_quality,
      updated_at: new Date().toISOString(),
    };
  }

  /**
   * Radar Óptico Preventivo completo em 1 chamada (todas as 8.924 ONUs + 7 OLTs + não configuradas)
   */
  async getOpticalRadar(params?: {
    threshold?: number;
    limit?: number;
    fresh?: boolean;
  }): Promise<SmartOltOpticalRadarResponse> {
    const response = await this.client.get<
      SmartOltOpticalRadarResponse & { status: boolean }
    >('/optical-radar', {
      params: {
        threshold: params?.threshold ?? -26,
        limit: params?.limit ?? 150,
        ...(params?.fresh ? { fresh: '1' } : {}),
      },
    });
    return {
      threshold: response.data.threshold,
      summary: response.data.summary,
      olts: response.data.olts || [],
      items: response.data.items || [],
      unconfigured_onus: response.data.unconfigured_onus || [],
    };
  }

  /**
   * Lista ONUs não configuradas aguardando autorização
   */
  async getUnconfiguredOnus(fresh = false): Promise<SmartOltUnconfiguredOnu[]> {
    try {
      const response = await this.client.get<{
        status: boolean;
        response?: SmartOltUnconfiguredOnu[];
      }>('/unconfigured', {
        params: fresh ? { fresh: '1' } : undefined,
      });
      return response.data.response || [];
    } catch (error) {
      console.error('Erro ao buscar ONUs não configuradas:', error);
      return [];
    }
  }

  /**
   * Coordenadas GPS das ONUs (com cache 30 min no servidor)
   */
  async getOnuGpsCoordinates(): Promise<Record<string, { lat: string; lng: string }>> {
    try {
      const response = await this.client.get<{
        status: boolean;
        data?: Record<string, { lat: string; lng: string }>;
      }>('/onus-gps');
      return response.data.data || {};
    } catch (error) {
      console.error('Erro ao buscar coordenadas GPS no SmartOLT:', error);
      return {};
    }
  }

  /**
   * Baixa o gráfico PNG de sinal óptico da ONT autenticado e retorna Object URL
   */
  async getOnuSignalGraphBlobUrl(
    onuExternalId: string,
    graphType: 'hourly' | 'daily' | 'weekly' = 'daily'
  ): Promise<string | null> {
    try {
      const response = await this.client.get<Blob>(
        `/onu-signal-graph/${encodeURIComponent(onuExternalId)}/${graphType}`,
        { responseType: 'blob' }
      );
      return URL.createObjectURL(response.data);
    } catch (error) {
      console.error('Erro ao carregar gráfico de sinal da ONT:', error);
      return null;
    }
  }

  /**
   * Executa ação remota na ONT (reboot, resync_config, enable, disable)
   */
  async runOnuAction(
    onuExternalId: string,
    action: 'reboot' | 'resync_config' | 'enable' | 'disable'
  ): Promise<{ success: boolean; message: string }> {
    try {
      const response = await this.client.post<{
        status: boolean;
        message?: string;
        error?: string;
      }>(`/onu-action/${action}/${encodeURIComponent(onuExternalId)}`);

      return {
        success: Boolean(response.data.status),
        message:
          response.data.message ||
          response.data.error ||
          'Comando enviado para a OLT.',
      };
    } catch (error: unknown) {
      const errObj = error as {
        response?: { data?: { error?: string; message?: string } };
        message?: string;
      };
      return {
        success: false,
        message:
          errObj?.response?.data?.error ||
          errObj?.response?.data?.message ||
          errObj?.message ||
          'Falha ao enviar comando para a OLT.',
      };
    }
  }

  async rebootOnu(onuExternalId: string): Promise<{ success: boolean; message: string }> {
    return this.runOnuAction(onuExternalId, 'reboot');
  }

  async resyncOnu(onuExternalId: string): Promise<{ success: boolean; message: string }> {
    return this.runOnuAction(onuExternalId, 'resync_config');
  }
}

export const smartOltService = new SmartOltService();
export default smartOltService;

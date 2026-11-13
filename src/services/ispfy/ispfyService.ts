import axios, { AxiosInstance } from 'axios';
import type { 
  ISPFYContratoData, 
  ISPFYFaturaData, 
  ISPFYTicketData, 
  ISPFYPlanoData, 
  ISPFYEquipamentoData, 
  ISPFYConexaoData,
  ISPFYClienteData,
  ISPFYLoginData,
  ISPFYPixData,
  ISPFYApiResponse,
  ISPFYUsageSeries,
  ISPFYBandwidthUsage,
  ISPFYCaixaData,
  ISPFYPosteData,
  ISPFYPopData,
  ISPFYFinancialCaixaData,
  ISPFYPayableData,
  ISPFYCashMovementData,
  ISPFYAuditClient,
  ISPFYAuditCancelledContract,
  ISPFYAuditDeletedRecord,
  ISPFYAuditSummary,
  ISPFYAuditData,
  ISPFYCarenciaItem,
  ISPFYClientRegionRecord,
  ISPFYClientsByRegionResult,
  ISPFYLivePointStatus,
  ISPFYOverdueAnalyticsResult
} from '@/types/ispfy';
import { syncAndDetectDeletedClients } from './auditSnapshotService';
import {
  buildOverdueAnalytics,
  getTodayLocalIsoDate,
} from './overdueHelpers';
import {
  EMPTY_BAIRRO_KEY,
  EMPTY_BAIRRO_LABEL,
  EMPTY_STREET_KEY,
  EMPTY_STREET_LABEL,
  aggregateRegionSummaries,
  classifyPointConnectionHealth,
  normalizeBairroKey,
  normalizeStreetKey,
  pickBestVariantLabel,
} from './regionAuditHelpers';

// =====================================================================
// Tipos e interfaces para a API ISPFY real (GET /api/object/*)
// Documentação: https://documenter.getpostman.com/view/7036186/SztK35tB
// =====================================================================

/**
 * Operadores suportados pela API ISPFY no parâmetro filter
 * Formato: campo:OPERADOR:valor
 */
export type ISPFYOperator = 'EQ' | 'NOT' | 'GT' | 'GTE' | 'LT' | 'LTE';

/**
 * Uma condição de filtro individual
 */
export interface ISPFYFilterCondition {
  field: string;
  operator: ISPFYOperator;
  value: string | number;
}

/**
 * Parâmetros para chamadas GET /api/object/*
 */
export interface ISPFYQueryParams {
  /** Filtro: pode ser string direta "campo:EQ:valor" ou condições combinadas */
  filter?: string;
  /** Limite de registros por página (padrão 10, -1 = sem limite) */
  limit?: number;
  /** Registro inicial (para paginação) */
  offset?: number;
  /** Ordenação: "campo:ASC" ou "campo:DESC" */
  sort?: string;
  /** Se TRUE retorna total, offset e limit junto com rows */
  pagination?: 'TRUE' | 'FALSE';
  /** Busca textual livre (ISPFY usa ?search= ou ?q= em vez de LIKE) */
  search?: string;
}

// =====================================================================
// Helpers de filtro
// =====================================================================

/**
 * Constrói uma string de filtro simples: campo:OPERADOR:valor
 */
function buildFilter(field: string, operator: ISPFYOperator, value: string | number): string {
  return `${field}:${operator}:${value}`;
}

/**
 * Combina múltiplos filtros com [AND]
 */
function andFilters(...filters: string[]): string {
  return filters.filter(Boolean).join(' [AND] ');
}

// =====================================================================
// ISPFYService
// =====================================================================

class ISPFYService {
  private static readonly FALLBACK_PROXY_HOST =
    'https://us-central1-avl-telecom.cloudfunctions.net/ispfyProxy';
  private client: AxiosInstance;
  private token: string;
  private cachedPlanos: ISPFYPlanoData[] | null = null;
  private cachedCidadesMap = new Map<string, string>();
  private auditBaseCache: {
    fetchedAt: number;
    clientes: ISPFYClienteData[];
    contratos: ISPFYContratoData[];
  } | null = null;
  private regionCache: {
    fetchedAt: number;
    data: ISPFYClientsByRegionResult;
  } | null = null;
  private regionMetadataCache: {
    fetchedAt: number;
    allClientes: ISPFYClienteData[];
    allContatos: any[];
    allPontoPlanos: any[];
    allPlanos: ISPFYPlanoData[];
  } | null = null;
  private overdueCache: {
    fetchedAt: number;
    data: ISPFYOverdueAnalyticsResult;
  } | null = null;

  constructor() {
    const host =
      import.meta.env.VITE_ISPFY_HOST || ISPFYService.FALLBACK_PROXY_HOST;
    const token = import.meta.env.VITE_ISPFY_TOKEN;

    // Cliente axios apontando para o proxy (/api/ispfy ou Cloud Function ispfyProxy)
    this.client = axios.create({
      baseURL: host,
      timeout: 120000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Token raw — a API ISPFY espera o header "Token" sem Base64
    this.token = token || '';

    // Interceptor: injeta header Token em todas as requisições autenticadas
    this.client.interceptors.request.use((config) => {
      if (this.token && config.headers) {
        config.headers['Token'] = this.token;
      }
      return config;
    });
  }

  // =====================================================================
  // Método central de requisição GET (rotas OBJECT)
  // =====================================================================

  /**
   * Executa GET /api/object/{endpoint} com os query params fornecidos.
   * A API ISPFY usa GET para listagem, com filtros via query string.
   */
  private async makeRequest<T>(
    endpoint: string,
    params: ISPFYQueryParams = {},
    retries = 2
  ): Promise<ISPFYApiResponse<T>> {
    
    // ==========================================
    // MOCK: Intercepta chamadas localmente (Bypass de Firewall)
    // ==========================================
    const USE_MOCKS = false; // Mude para true se quiser usar dados falsos
    
    if (USE_MOCKS) {
      if (endpoint.includes('/cliente') && !endpoint.includes('/cliente/contrato')) {
        console.log(`[MOCK ISPFY] Retornando dados falsos para ${endpoint}`);
        return {
          total: 1, limit: 300, offset: 0,
          rows: [{
            id: '12345',
            nome: 'João da Silva (MOCK LOCAL)',
            tipo_pessoa: 'F',
            cnpj_cpf: '123.456.789-00',
            fone_celular: '(11) 99999-9999',
            fone_whatsapp: '(11) 99999-9999',
            email: 'joao@mock.com',
            endereco: 'Rua das Flores, 123',
            bairro: 'Centro',
            cidade: 'São Paulo',
            cep: '01000-000',
            ativo: 'S', lead: 'N', principal: 'S'
          } as any]
        };
      }

      if (endpoint.includes('/cliente/contrato')) {
        console.log(`[MOCK ISPFY] Retornando contrato falso para ${endpoint}`);
        return {
          total: 1, limit: 300, offset: 0,
          rows: [{
            id: '9999',
            id_cliente: '12345',
            descricao: 'Plano Fibra 500 Mega',
            valor: '99.90',
            status: 'A',
            status_internet: 'A',
            data_inicio: '2025-01-01',
          } as any]
        };
      }

      if (endpoint.includes('/cliente/contrato/cobranca')) {
        console.log(`[MOCK ISPFY] Retornando fatura falsa para ${endpoint}`);
        return {
          total: 1, limit: 300, offset: 0,
          rows: [{
            id: '8888',
            id_cliente: '12345',
            valor: '99.90',
            data_vencimento: '2026-10-10',
            status: 'A',
            descricao: 'Mensalidade Outubro/2026',
            gateway_link: 'https://gateway.falso.com/pagar/8888',
            link_getwere: 'https://getwere.falso.com/8888',
            url_boleto: 'https://boleto.falso.com/pdf/8888'
          } as any]
        };
      }
    }
    // ==========================================

    // Sempre solicitar paginação para obter o total
    const queryParams: ISPFYQueryParams = {
      pagination: 'TRUE',
      limit: 300,
      offset: 0,
      ...params,
    };

    for (let attempt = 1; attempt <= retries + 1; attempt++) {
      try {
        console.log(`[ISPFY Request] GET /api/object${endpoint}`, { params: queryParams });
        const response = await this.client.get<ISPFYApiResponse<T>>(
          `/api/object${endpoint}`,
          { params: queryParams }
        );
        if (
          typeof response.data === 'string' &&
          (response.data as string).trim().startsWith('<')
        ) {
          if (this.client.defaults.baseURL !== ISPFYService.FALLBACK_PROXY_HOST) {
            console.warn('[ISPFY Proxy] Resposta HTML recebida; alternando para Cloud Function ispfyProxy.');
            this.client.defaults.baseURL = ISPFYService.FALLBACK_PROXY_HOST;
            continue;
          }
          throw new Error('Proxy ISPFY retornou HTML em vez de JSON.');
        }
        return response.data;
      } catch (error: any) {
        if (error.response) {
          console.error(`[ISPFY Error] Status: ${error.response.status} on GET /api/object${endpoint}`);
          console.error('[ISPFY Error Data]:', error.response.data);
        }

        const isTimeout =
          error.code === 'ECONNABORTED' ||
          error.message?.toLowerCase().includes('timeout') ||
          error.response?.status >= 500;

        if (isTimeout && attempt <= retries) {
          console.warn(
            `⏳ [ISPFY] Tentativa ${attempt} falhou em ${endpoint}. Retentando em ${attempt * 1500}ms...`
          );
          await new Promise((r) => setTimeout(r, attempt * 1500));
          continue;
        }

        if (axios.isAxiosError(error)) {
          throw new Error(`Erro na API ISPFY: ${error.message}`);
        }
        throw error;
      }
    }
    throw new Error('Falha na requisição ISPFY após retentativas.');
  }

  /**
   * Extrai os registros de uma resposta, suportando tanto `rows` (API nova)
   * quanto `registros` (fallback legado).
   */
  private getRows<T>(response: ISPFYApiResponse<T> | T[]): T[] {
    if (Array.isArray(response)) return response;
    // A API real retorna 'data', mas mantemos compat com 'rows'/'registros'
    return (response.data ?? response.rows ?? response.registros ?? []) as T[];
  }

  private getTotal(response: ISPFYApiResponse<unknown>): number {
    return response.count ?? response.total ?? 0;
  }

  // =====================================================================
  // Método genérico de busca recursiva (paginação automática)
  // =====================================================================

  private async fetchAllRecords<T>(
    endpoint: string,
    params: ISPFYQueryParams = {},
    onProgress?: (total: number) => void
  ): Promise<T[]> {
    let allRecords: T[] = [];
    let offset = 0;
    const limit = 300;
    let hasMore = true;

    while (hasMore) {
      try {
        const response = await this.makeRequest<T>(endpoint, {
          ...params,
          limit,
          offset,
        });

        const rows = this.getRows(response);
        allRecords = [...allRecords, ...rows];

        console.log(
          `[fetchAllRecords] ${endpoint}: offset=${offset}, registros=${rows.length}, acumulado=${allRecords.length}`
        );

        if (onProgress) onProgress(allRecords.length);

        // Se retornou menos que o limite, chegamos ao fim
        if (rows.length < limit || rows.length === 0) {
          hasMore = false;
        } else {
          offset += limit;
        }
      } catch (error) {
        console.error(`Erro ao buscar página offset=${offset} de ${endpoint}:`, error);
        hasMore = false;
      }
    }

    return allRecords;
  }

  // =====================================================================
  // Método de escrita (POST para criar, PUT para editar)
  // =====================================================================

  private async writeRequest<T>(
    method: 'post' | 'put' | 'delete',
    endpoint: string,
    data?: Record<string, unknown>
  ): Promise<T> {
    const headers: Record<string, string> = {};
    if (this.token) headers['Token'] = this.token;

    const response = await this.client.request<T>({
      method,
      url: `/api/object${endpoint}`,
      data,
      headers,
    });
    return response.data;
  }

  // =====================================================================
  // CLIENTES
  // =====================================================================

  async getClienteByCnpjCpf(cnpjCpf: string): Promise<ISPFYClienteData | null> {
    // A API armazena sem formatação — remove pontos, traços, barras
    const digits = cnpjCpf.replace(/\D/g, '');
    const response = await this.makeRequest<ISPFYClienteData>('/cliente', {
      filter: buildFilter('cpf_cnpj', 'EQ', digits),
      limit: 1,
    });
    const rows = this.getRows(response);
    return rows[0] ?? null;
  }

  async getClienteByPhone(phone: string): Promise<ISPFYClienteData | null> {
    console.log(`🔍 Iniciando busca no ISPFY para o telefone: ${phone}`);

    let cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.startsWith('55') && cleanPhone.length > 10) {
      cleanPhone = cleanPhone.substring(2);
    }
    console.log(`📱 Telefone limpo para busca: ${cleanPhone}`);

    const ddd = cleanPhone.slice(0, 2);
    const rest = cleanPhone.slice(2);

    let formattedCel = '';
    let formattedFix = '';

    if (rest.length === 9) {
      formattedCel = `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
      formattedFix = `(${ddd}) ${rest.slice(1, 5)}-${rest.slice(5)}`;
    } else if (rest.length === 8) {
      formattedCel = `(${ddd}) 9${rest.slice(0, 4)}-${rest.slice(4)}`;
      formattedFix = `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
    }

    const fields = [
      'fone_celular',
      'fone_whatsapp',
      'fone_residencial',
      'telefone_celular',
    ];

    const searchTerms = [formattedCel, formattedFix, `%${cleanPhone.slice(-8)}%`].filter(
      (t) => t !== ''
    );

    for (const term of searchTerms) {
      const operator: ISPFYOperator = 'EQ';
      for (const field of fields) {
        console.log(`📡 Tentando campo: ${field} com termo: ${term}`);
        try {
          const response = await this.makeRequest<ISPFYClienteData>('/cliente', {
            filter: buildFilter(field, operator, term),
            limit: 1,
          });
          const rows = this.getRows(response);
          if (rows.length > 0) {
            console.log(`✅ Cliente encontrado! Campo: ${field}, Termo: ${term}`, rows[0].razao);
            return rows[0];
          }
        } catch {
          // Continua tentando
        }
      }
    }

    console.warn(`⚠️ Nenhum cliente encontrado no ISPFY para o telefone ${phone}`);
    return null;
  }

  async getClienteByNome(nome: string): Promise<ISPFYClienteData[]> {
    // ISPFY não suporta LIKE — usa ?search= para busca textual
    const response = await this.makeRequest<ISPFYClienteData>('/cliente', {
      search: nome,
      limit: 1000,
      sort: 'id:DESC',
    });
    return this.getRows(response);
  }

  async getClienteById(id: string): Promise<ISPFYClienteData | null> {
    const response = await this.makeRequest<ISPFYClienteData>('/cliente', {
      filter: buildFilter('id', 'EQ', id),
      limit: 1,
    });
    const rows = this.getRows(response);
    return rows[0] ?? null;
  }

  async getClienteByCPF(cpf: string): Promise<ISPFYClienteData | null> {
    // Strip formatting — API stores digits only
    const digits = cpf.replace(/\D/g, '');
    console.log(`🔍 Buscando cliente no ISPFY com CPF/CNPJ: ${digits}`);
    return this.getClienteByCnpjCpf(digits);
  }

  async getAllClientes(
    page: number = 1,
    rp: number = 300,
    sortname: string = 'id',
    sortorder: 'asc' | 'desc' = 'desc'
  ): Promise<ISPFYApiResponse<ISPFYClienteData>> {
    const offset = (page - 1) * rp;
    return this.makeRequest<ISPFYClienteData>('/cliente', {
      limit: rp,
      offset,
      sort: `${sortname}:${sortorder.toUpperCase()}`,
    });
  }

  async getClientesByCidade(cidade: string): Promise<ISPFYClienteData[]> {
    const response = await this.makeRequest<ISPFYClienteData>('/cliente', {
      search: cidade,
      limit: 1000,
      sort: 'id:DESC',
    });
    return this.getRows(response);
  }

  async getClientesAtivos(): Promise<ISPFYClienteData[]> {
    const response = await this.makeRequest<ISPFYClienteData>('/cliente', {
      limit: 10000,
      sort: 'id:DESC',
    });
    return this.getRows(response);
  }

  async getLeads(): Promise<ISPFYClienteData[]> {
    const response = await this.makeRequest<ISPFYClienteData>('/cliente', {
      filter: buildFilter('lead', 'EQ', 'S'),
      limit: 1000,
      sort: 'id:DESC',
    });
    return this.getRows(response);
  }

  async getClienteContatos(idCliente: string): Promise<any[]> {
    const response = await this.makeRequest<any>('/cliente/contato', {
      filter: buildFilter('id_cliente', 'EQ', idCliente),
      limit: 100,
    });
    return this.getRows(response);
  }

  async searchClientes(
    field: string,
    value: string,
    operator: ISPFYOperator = 'EQ',
    page: number = 1,
    rp: number = 100,
    sortname: string = 'id',
    sortorder: 'asc' | 'desc' = 'desc'
  ): Promise<ISPFYApiResponse<ISPFYClienteData>> {
    const offset = (page - 1) * rp;
    return this.makeRequest<ISPFYClienteData>('/cliente', {
      filter: buildFilter(field, operator, value),
      limit: rp,
      offset,
      sort: `${sortname}:${sortorder.toUpperCase()}`,
    });
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.getAllClientes(1, 1);
      return true;
    } catch (error) {
      console.error('Erro ao testar conexão com ISPFY:', error);
      return false;
    }
  }

  async getAllClientesCount(): Promise<number> {
    const response = await this.makeRequest<ISPFYClienteData>('/cliente', { limit: 1 });
    return this.getTotal(response);
  }

  async getClientesAtivosCount(): Promise<number> {
    const response = await this.makeRequest<ISPFYClienteData>('/cliente', {
      filter: buildFilter('ativo', 'EQ', 'S'),
      limit: 1,
    });
    return this.getTotal(response);
  }

  // =====================================================================
  // CLIENTES — busca recursiva
  // =====================================================================

  async fetchAllClientesByStatus(
    status: 'S' | 'N',
    onProgress?: (total: number) => void
  ): Promise<ISPFYClienteData[]> {
    // O endpoint /cliente no ISPFY não aceita o campo 'ativo'.
    // Removemos o filtro para evitar o erro 500.
    return this.fetchAllRecords<ISPFYClienteData>(
      '/cliente',
      { sort: 'id:DESC' },
      onProgress
    );
  }

  async fetchAllClientesAtivos(
    onProgress?: (total: number) => void
  ): Promise<ISPFYClienteData[]> {
    return this.fetchAllClientesByStatus('S', onProgress);
  }

  async fetchAllClientes(
    onProgress?: (total: number) => void
  ): Promise<ISPFYClienteData[]> {
    try {
      // Como não existe mais filtro 'ativo', uma chamada já traz todos os clientes
      const todos = await this.fetchAllClientesByStatus('S', onProgress);
      return todos.sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
    } catch (error) {
      console.error('Erro em fetchAllClientes:', error);
      throw error;
    }
  }

  // =====================================================================
  // CONTRATOS
  // =====================================================================

  async getContratosByCliente(idCliente: string): Promise<ISPFYContratoData[]> {
    const response = await this.makeRequest<ISPFYContratoData>('/cliente/contrato', {
      filter: buildFilter('id_cliente', 'EQ', idCliente),
      limit: 1000,
      sort: 'id:DESC',
    });
    return this.getRows(response);
  }

  async getContratoById(id: string): Promise<ISPFYContratoData | null> {
    const response = await this.makeRequest<ISPFYContratoData>('/cliente/contrato', {
      filter: buildFilter('id', 'EQ', id),
      limit: 1,
    });
    const rows = this.getRows(response);
    return rows[0] ?? null;
  }

  async getContratosAtivos(): Promise<ISPFYContratoData[]> {
    const response = await this.makeRequest<ISPFYContratoData>('/cliente/contrato', {
      filter: buildFilter('contrato_ativo', 'EQ', 'S'),
      limit: 1000,
      sort: 'id:DESC',
    });
    return this.getRows(response);
  }

  async getContratosAtivosCount(): Promise<number> {
    const response = await this.makeRequest<ISPFYContratoData>('/cliente/contrato', {
      filter: buildFilter('contrato_ativo', 'EQ', 'S'),
      limit: 1,
    });
    return this.getTotal(response);
  }

  async fetchAllContratosAtivos(
    onProgress?: (total: number) => void
  ): Promise<ISPFYContratoData[]> {
    return this.fetchAllRecords<ISPFYContratoData>(
      '/cliente/contrato',
      { filter: buildFilter('contrato_ativo', 'EQ', 'S'), sort: 'id:DESC' },
      onProgress
    );
  }

  async fetchAllContratosBloqueados(
    onProgress?: (total: number) => void
  ): Promise<ISPFYContratoData[]> {
    return this.fetchAllRecords<ISPFYContratoData>(
      '/cliente/contrato',
      { filter: buildFilter('status_contrato', 'EQ', 'bloqueado'), sort: 'id:DESC' },
      onProgress
    );
  }

  async fetchAllContratos(
    onProgress?: (total: number) => void
  ): Promise<ISPFYContratoData[]> {
    return this.fetchAllRecords<ISPFYContratoData>(
      '/cliente/contrato',
      { sort: 'id:DESC' },
      onProgress
    );
  }

  async fetchAllContatos(
    onProgress?: (total: number) => void
  ): Promise<any[]> {
    return this.fetchAllRecords<any>(
      '/cliente/contato',
      { sort: 'id:DESC' },
      onProgress
    );
  }

  async unlockContract(idContrato: string): Promise<{ success: boolean; message: string }> {
    try {
      console.log(`🔓 Tentando desbloquear contrato ID: ${idContrato}...`);
      await this.writeRequest('post', `/cliente/contrato_desbloqueio`, { id: idContrato });
      return { success: true, message: 'Contrato desbloqueado em confiança com sucesso!' };
    } catch (error: any) {
      console.error('Erro ao desbloquear contrato:', error);
      const errorMsg = error.response?.data?.message || 'Erro ao processar desbloqueio.';
      return { success: false, message: errorMsg };
    }
  }

  async updateContrato(
    id: string,
    data: Record<string, unknown>
  ): Promise<{ success: boolean; message: string }> {
    try {
      const response = await this.writeRequest<any>('put', `/cliente/contrato/${id}`, data);
      if (response?.type === 'error') {
        const msg = response.message?.replace(/<br \/>/g, ', ') || 'Erro de validação no ISPFY';
        return { success: false, message: msg };
      }
      return { success: true, message: 'Contrato atualizado com sucesso!' };
    } catch (error: any) {
      return { success: false, message: error.response?.data?.message || 'Erro ao atualizar contrato.' };
    }
  }

  async getCarenciaContracts(): Promise<ISPFYCarenciaItem[]> {
    try {
      const response = await this.makeRequest<ISPFYContratoData>('/cliente/contrato', {
        filter: 'data_final_carencia:NOT:null',
        limit: 300,
      });
      const rows = this.getRows(response);
      const carenciaContracts = rows.filter((c) => !!c.data_final_carencia);
      const results: ISPFYCarenciaItem[] = [];

      for (const c of carenciaContracts) {
        let clientName = 'Cliente';
        let clientPhone = '';
        let clientCpfCnpj = '';

        if (c.id_cliente) {
          try {
            const cliResp = await this.makeRequest<ISPFYClienteData>('/cliente', {
              filter: `id:EQ:${c.id_cliente}`,
              limit: 1,
            });
            const client = this.getRows(cliResp)[0];
            if (client) {
              clientName = client.nome_razao || client.nome || 'Cliente';
              clientCpfCnpj = client.cpf_cnpj || client.cnpj_cpf || '';
              clientPhone = client.fone_whatsapp || client.fone_celular || '';
            }

            if (!clientPhone) {
              const contResp = await this.makeRequest<any>('/cliente/contato', {
                filter: `id_cliente:EQ:${c.id_cliente}`,
                limit: 5,
              });
              const contatos = this.getRows(contResp);
              const validContato = contatos.find((ct) => ct.contato && ct.pode_enviar_mensagem !== 'n');
              if (validContato) {
                clientPhone = validContato.contato;
              }
            }
          } catch (e) {
            console.warn(`Erro ao enriquecer cliente ${c.id_cliente}:`, e);
          }
        }

        results.push({
          contratoId: String(c.id),
          clienteId: String(c.id_cliente || ''),
          clienteNome: clientName,
          clienteTelefone: clientPhone,
          clienteCpfCnpj: clientCpfCnpj,
          dataFinalCarencia: c.data_final_carencia || '',
          dataUltimaCarencia: c.data_ultima_carencia || '',
          statusContrato: c.status_contrato,
          statusInternet: c.status_internet,
          valorMensal: c.valor_mensal || c.valor,
        });
      }

      return results;
    } catch (error) {
      console.error('Erro ao buscar contratos em carência:', error);
      return [];
    }
  }

  async setContratoCarencia(
    idContrato: string,
    dataFinalCarencia: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
      const response = await this.updateContrato(idContrato, {
        data_final_carencia: dataFinalCarencia,
        data_ultima_carencia: today,
      });
      return response;
    } catch (error: any) {
      return { success: false, message: error.message || 'Erro ao aplicar carência' };
    }
  }

  async getPendingContracts(idCliente: string): Promise<ISPFYContratoData[]> {
    const response = await this.makeRequest<ISPFYContratoData>('/cliente/contrato', {
      filter: buildFilter('id_cliente', 'EQ', idCliente),
      limit: 100,
    });
    return this.getRows(response).filter(
      (c) => c.assinatura_digital === 'S' && c.contrato_assinado === 'N'
    );
  }

  async checkUnlockEligibility(
    idCliente: string
  ): Promise<{ eligible: boolean; reason?: string }> {
    try {
      const contratos = await this.getContratosByCliente(idCliente);
      const bloqueados = contratos.filter(
        (c) => c.status_internet === 'FA' || c.status_internet === 'CA'
      );
      if (bloqueados.length === 0) {
        return { eligible: false, reason: 'Nenhum contrato bloqueado encontrado.' };
      }
      return { eligible: true };
    } catch {
      return { eligible: false };
    }
  }

  async updateDueDate(
    idCliente: string,
    idContrato: string | undefined,
    newDay: string,
    target: 'both' | 'contract' | 'client' = 'both'
  ): Promise<{ success: boolean; message: string }> {
    try {
      const dayNumber = parseInt(newDay, 10);
      const dayStr = !isNaN(dayNumber) ? String(dayNumber).padStart(2, '0') : newDay;

      let contractResult = { success: true, message: 'Nenhum contrato alterado' };
      let clientResult = { success: true, message: 'Nenhum cliente alterado' };

      if ((target === 'both' || target === 'contract') && idContrato) {
        contractResult = await this.updateContrato(idContrato, {
          vencimento: dayStr,
          dia_vencimento: dayStr,
          dia_pagto: dayStr,
        });
      }

      if (target === 'both' || target === 'client' || (!idContrato && target === 'both')) {
        clientResult = await this.updateCliente(idCliente, {
          vencimento: dayStr,
          dia_vencimento: dayStr,
        } as any);
      }

      if (!contractResult.success && !clientResult.success) {
        return { success: false, message: contractResult.message || clientResult.message };
      }
      if (!contractResult.success && idContrato) {
        return { success: false, message: `Contrato: ${contractResult.message}` };
      }
      if (!clientResult.success) {
        return { success: false, message: `Cliente: ${clientResult.message}` };
      }

      return { success: true, message: `Vencimento atualizado para o dia ${dayStr} com sucesso!` };
    } catch (error: any) {
      return { success: false, message: error.message || 'Erro ao atualizar vencimento' };
    }
  }

  // =====================================================================
  // FATURAS (fn_areceber)
  // =====================================================================

  async getFaturasByCliente(idCliente: string): Promise<ISPFYFaturaData[]> {
    // Cobranca nao tem id_cliente, busca pelos contratos do cliente primeiro
    const contratos = await this.getContratosByCliente(idCliente);
    if (contratos.length === 0) return [];
    const contratoId = contratos[0].id; // usa o primeiro contrato
    const response = await this.makeRequest<ISPFYFaturaData>('/cliente/contrato/cobranca', {
      filter: buildFilter('id_contrato', 'EQ', contratoId),
      limit: 1000,
      sort: 'data_vencimento:ASC',
    });
    return this.getRows(response);
  }

  async getFaturasAbertas(idCliente?: string): Promise<ISPFYFaturaData[]> {
    const filter = buildFilter('status', 'EQ', 'aberto');
    const response = await this.makeRequest<ISPFYFaturaData>('/cliente/contrato/cobranca', {
      filter,
      limit: 1000,
      sort: 'data_vencimento:ASC',
    });
    return this.getRows(response).filter((f) => !f.data_pagamento);
  }

  async getFaturaById(id: string): Promise<ISPFYFaturaData | null> {
    const response = await this.makeRequest<ISPFYFaturaData>('/cliente/contrato/cobranca', {
      filter: buildFilter('id', 'EQ', id),
      limit: 1,
    });
    const rows = this.getRows(response);
    return rows[0] ?? null;
  }

  async getFaturasVencidas(): Promise<ISPFYFaturaData[]> {
    const hoje = new Date().toISOString().split('T')[0];
    const response = await this.makeRequest<ISPFYFaturaData>('/cliente/contrato/cobranca', {
      filter: andFilters(
        buildFilter('data_vencimento', 'LT', hoje),
        buildFilter('status', 'EQ', 'aberto')
      ),
      limit: 1000,
      sort: 'data_vencimento:DESC',
    });
    return this.getRows(response).filter((f) => !f.pagamento_data);
  }

  async fetchAllFaturasAbertas(
    onProgress?: (total: number) => void
  ): Promise<ISPFYFaturaData[]> {
    const faturas = await this.fetchAllRecords<ISPFYFaturaData>(
      '/cliente/contrato/cobranca',
      {
        filter: buildFilter('status', 'EQ', 'aberto'),
        sort: 'data_vencimento:ASC',
      },
      onProgress
    );
    return faturas.filter((f) => !f.pagamento_data);
  }

  async fetchRecentFaturasPagas(
    days: number = 180,
    onProgress?: (total: number) => void
  ): Promise<ISPFYFaturaData[]> {
    const date = new Date();
    date.setDate(date.getDate() - days);
    const dateStr = date.toISOString().split('T')[0];

    return this.fetchAllRecords<ISPFYFaturaData>(
      '/cliente/contrato/cobranca',
      {
        filter: andFilters(
          buildFilter('pagamento_data', 'GTE', dateStr),
          buildFilter('status', 'EQ', 'pago')
        ),
        sort: 'pagamento_data:DESC',
      },
      onProgress
    );
  }

  async sendEmailFatura(idFatura: string): Promise<boolean> {
    try {
      console.log(`📧 Tentativa de envio de e-mail para fatura ${idFatura} ignorada (ISPFY não suporta esta rota diretamente)`);
      // O ISPFY não tem uma rota direta parecida com a do IXC para enviar e-mail da fatura avulsa
      return true;
    } catch (error) {
      console.error(`Erro ao enviar e-mail da fatura ${idFatura}:`, error);
      return false;
    }
  }

  // =====================================================================
  // FINANCEIRO — resumos e relatórios
  // =====================================================================

  async getFinancialSummary(idCaixa?: string): Promise<{
    todayRevenue: number;
    monthRevenue: number;
    totalOpen: number;
    totalOverdue: number;
    countOverdue: number;
  }> {
    const today = new Date().toISOString().split('T')[0];
    const firstDayOfMonth = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      1
    ).toISOString().split('T')[0];

    // 1. Receita do dia (pago hoje)
    const todayPayments = await this.fetchAllRecords<ISPFYFaturaData>('/cliente/contrato/cobranca', {
      filter: buildFilter('pagamento_data', 'EQ', today),
      sort: 'pagamento_data:DESC',
    });
    const todayFiltered = idCaixa
      ? todayPayments.filter((p) => p.id_caixa_receb === idCaixa)
      : todayPayments;
    const todayRevenue = todayFiltered.reduce(
      (acc, curr) => acc + parseFloat(curr.pagamento_valor || '0'),
      0
    );

    // 2. Receita do mês
    const monthPayments = await this.fetchAllRecords<ISPFYFaturaData>('/cliente/contrato/cobranca', {
      filter: buildFilter('pagamento_data', 'GTE', firstDayOfMonth),
    });
    const monthFiltered = idCaixa
      ? monthPayments.filter((p) => p.id_caixa_receb === idCaixa)
      : monthPayments;
    const monthRevenue = monthFiltered.reduce(
      (acc, curr) => acc + parseFloat(curr.pagamento_valor || '0'),
      0
    );

    // 3. A Receber (aberto)
    const openInvoices = await this.fetchAllRecords<ISPFYFaturaData>('/cliente/contrato/cobranca', {
      filter: buildFilter('status', 'EQ', 'aberto'),
    });
    const trulyOpen = openInvoices.filter((f) => !f.pagamento_data);
    const totalOpen = trulyOpen.reduce((acc, curr) => acc + parseFloat(curr.valor || '0'), 0);

    // 4. Vencido
    const overdue = trulyOpen.filter((f) => f.data_vencimento && f.data_vencimento < today);
    const totalOverdue = overdue.reduce((acc, curr) => acc + parseFloat(curr.valor || '0'), 0);

    return { todayRevenue, monthRevenue, totalOpen, totalOverdue, countOverdue: overdue.length };
  }

  async getDailyRevenue(days: number = 30): Promise<{ date: string; value: number }[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split('T')[0];

    const payments = await this.fetchAllRecords<ISPFYFaturaData>('/cliente/contrato/cobranca', {
      filter: buildFilter('pagamento_data', 'GTE', startDateStr),
    });

    const dailyMap = new Map<string, number>();
    for (let i = 0; i <= days; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      const displayDate = `${dateStr.split('-')[2]}/${dateStr.split('-')[1]}`;
      dailyMap.set(displayDate, 0);
    }

    payments.forEach((p) => {
      if (p.pagamento_data) {
        const parts = (p.pagamento_data as string).split('-');
        if (parts.length === 3) {
          const displayDate = `${parts[2]}/${parts[1]}`;
          const current = dailyMap.get(displayDate) || 0;
          dailyMap.set(displayDate, current + parseFloat((p.pagamento_valor as string) || '0'));
        }
      }
    });

    return Array.from(dailyMap.entries()).map(([date, value]) => ({ date, value }));
  }

  async getTopDebtors(
    limit: number = 10
  ): Promise<{ nome: string; valor: number; id_cliente: string }[]> {
    const today = new Date().toISOString().split('T')[0];

    const response = await this.makeRequest<ISPFYFaturaData>('/cliente/contrato/cobranca', {
      filter: andFilters(
        buildFilter('data_vencimento', 'LT', today),
        buildFilter('status', 'EQ', 'A')
      ),
      limit: 2000,
      sort: 'valor:DESC',
    });

    const faturas = this.getRows(response);
    const openFaturas = faturas.filter((f) => f.status === 'aberto' && !f.pagamento_data);

    const clientDebt = new Map<string, { nome: string; valor: number; id_cliente: string }>();
    for (const fat of openFaturas) {
      if (!fat.id_cliente) continue;
      const current = clientDebt.get(fat.id_cliente) || {
        nome: 'Cliente ' + fat.id_cliente,
        valor: 0,
        id_cliente: fat.id_cliente,
      };
      clientDebt.set(fat.id_cliente, {
        ...current,
        valor: current.valor + parseFloat(fat.valor || '0'),
      });
    }

    const sorted = Array.from(clientDebt.values())
      .sort((a, b) => b.valor - a.valor)
      .slice(0, limit);

    return Promise.all(
      sorted.map(async (d) => {
        if (d.nome.startsWith('Cliente ')) {
          const cliente = await this.getClienteById(d.id_cliente);
          return { ...d, nome: cliente ? cliente.razao || cliente.nome || 'Desconhecido' : d.nome };
        }
        return d;
      })
    );
  }

  async getFullFinancialSummary(
    days: number = 30,
    idCaixa?: string
  ): Promise<{
    inflow: number;
    outflow: number;
    balance: number;
    dailyData: { date: string; inflow: number; outflow: number }[];
  }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split('T')[0];

    const incomes = await this.fetchAllRecords<ISPFYFaturaData>('/cliente/contrato/cobranca', {
      filter: buildFilter('pagamento_data', 'GTE', startDateStr),
    });
    const incomesFiltered = idCaixa
      ? incomes.filter((p) => p.id_caixa_receb === idCaixa)
      : incomes;

    const expenses = await this.fetchAllRecords<ISPFYPayableData>('/fn_apagar', {
      filter: buildFilter('pagamento_data', 'GTE', startDateStr),
    });
    const expensesFiltered = idCaixa
      ? expenses.filter((p) => p.id_caixa_pagam === idCaixa)
      : expenses;

    const dailyMap = new Map<string, { inflow: number; outflow: number }>();
    for (let i = 0; i <= days; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      const displayDate = `${dateStr.split('-')[2]}/${dateStr.split('-')[1]}`;
      dailyMap.set(displayDate, { inflow: 0, outflow: 0 });
    }

    let totalInflow = 0;
    incomesFiltered.forEach((p) => {
      if (p.pagamento_data) {
        const parts = (p.pagamento_data as string).split('-');
        const displayDate = `${parts[2]}/${parts[1]}`;
        const current = dailyMap.get(displayDate) || { inflow: 0, outflow: 0 };
        const value = parseFloat((p.pagamento_valor as string) || '0');
        dailyMap.set(displayDate, { ...current, inflow: current.inflow + value });
        totalInflow += value;
      }
    });

    let totalOutflow = 0;
    expensesFiltered.forEach((p) => {
      if (p.data_pagamento) {
        const parts = (p.data_pagamento as string).split('-');
        const displayDate = `${parts[2]}/${parts[1]}`;
        const current = dailyMap.get(displayDate) || { inflow: 0, outflow: 0 };
        const value = parseFloat((p.valor_pago as string) || '0');
        dailyMap.set(displayDate, { ...current, outflow: current.outflow + value });
        totalOutflow += value;
      }
    });

    return {
      inflow: totalInflow,
      outflow: totalOutflow,
      balance: totalInflow - totalOutflow,
      dailyData: Array.from(dailyMap.entries()).map(([date, data]) => ({
        date,
        inflow: data.inflow,
        outflow: data.outflow,
      })),
    };
  }

  // =====================================================================
  // PIX / BOLETO
  // =====================================================================

  async getPixQrCode(idFatura: string): Promise<ISPFYPixData | null> {
    try {
      console.log(`💎 Gerando PIX para fatura ${idFatura}...`);
      const response = await this.client.post<ISPFYPixData>(
        `/api/object/get_pix_qrcode/${idFatura}`,
        { id: idFatura },
        { headers: this.token ? { Token: this.token } : {} }
      );
      return response.data;
    } catch (error) {
      console.error(`Erro ao obter PIX para fatura ${idFatura}:`, error);
      return null;
    }
  }

  async getBoletoPdf(idFatura: string): Promise<{ url: string } | null> {
    try {
      const response = await this.client.post<{ link: string }>(
        `/api/object/get_boleto/${idFatura}`,
        { id: idFatura },
        { headers: this.token ? { Token: this.token } : {} }
      );
      if (response.data?.link) return { url: response.data.link };
      return null;
    } catch (error) {
      console.error(`Erro ao obter boleto PDF para fatura ${idFatura}:`, error);
      return null;
    }
  }

  // =====================================================================
  // TICKETS (/suporte/ticket)
  // =====================================================================

  async getTicketsByCliente(idCliente: string): Promise<ISPFYTicketData[]> {
    const response = await this.makeRequest<ISPFYTicketData>('/suporte/ticket', {
      filter: buildFilter('id_cliente', 'EQ', idCliente),
      limit: 1000,
      sort: 'id:DESC',
    });
    return this.getRows(response);
  }

  async getTicketsAbertos(): Promise<ISPFYTicketData[]> {
    const response = await this.makeRequest<ISPFYTicketData>('/suporte/ticket', {
      search: 'Aberto',
      limit: 1000,
      sort: 'id:DESC',
    });
    return this.getRows(response);
  }

  async getTicketsAbertosCount(): Promise<number> {
    const response = await this.makeRequest<ISPFYTicketData>('/suporte/ticket', {
      search: 'Aberto',
      limit: 1,
    });
    return this.getTotal(response);
  }

  async getTicketById(id: string): Promise<ISPFYTicketData | null> {
    const response = await this.makeRequest<ISPFYTicketData>('/suporte/ticket', {
      filter: buildFilter('id', 'EQ', id),
      limit: 1,
    });
    const rows = this.getRows(response);
    return rows[0] ?? null;
  }

  async getTicketSubjects(): Promise<{ id: string; assunto: string }[]> {
    const response = await this.makeRequest<any>('/suporte/topico', {
      limit: 1000,
    });
    const rows = this.getRows(response);
    return rows.map(r => ({
      id: r.id,
      assunto: r.titulo || r.assunto || r.nome || 'Sem título',
    }));
  }

  async createTicket(ticketData: {
    id_cliente: string;
    id_assunto: string;
    prioridade: string;
    mensagem: string;
    id_departamento?: string;
  }): Promise<{ success: boolean; message: string; id?: string }> {
    const payload = {
      id_cliente: ticketData.id_cliente,
      id_topico: ticketData.id_assunto,
      requisicao: ticketData.mensagem,
      setor: 'TECNICO',
    };

    console.log('📝 Criando ticket — payload:', payload);

    const headers: Record<string, string> = {};
    if (this.token) headers['Token'] = this.token;

    // ── Tentativa 1: rota Tool (path relativo ao baseURL /api/ispfy) ──────────
    // baseURL = /api/ispfy  →  /tool/assinante/ticket  →  /api/ispfy/tool/assinante/ticket ✅
    try {
      const response = await this.client.post<any>('/tool/assinante/ticket', payload, { headers });
      const data = response.data;
      if (data && data.type !== 'error') {
        const id = data.id ?? data.dados?.id ?? data.ticket?.id ?? '';
        console.log('✅ Ticket criado via /tool/assinante/ticket. ID:', id);
        return { success: true, message: 'Chamado aberto com sucesso!', id: String(id) };
      }
      console.warn('⚠️ Resposta inesperada da rota tool:', data);
    } catch (err: any) {
      const errorMsg = err.response?.data?.details || err.response?.data?.message || err.message;
      
      // HACK: A API do ISPFY tem um bug bizarro onde retorna o ID do ticket recém-criado
      // como o HTTP STATUS CODE (ex: HTTP/1.1 2710). 
      // Quando isso passa pelo proxy do Firebase (Express), o `res.status(2710)` quebra
      // gerando um erro interno "Invalid status code: 2710". 
      // Se detectarmos isso, sabemos que o ticket foi criado com sucesso e pegamos o ID!
      if (typeof errorMsg === 'string' && errorMsg.includes('Invalid status code:')) {
        const match = errorMsg.match(/Invalid status code:\s*(\d+)/);
        if (match && match[1]) {
          const id = match[1];
          console.log(`✅ Ticket criado! ID resgatado do erro de status code da API: ${id}`);
          return { success: true, message: 'Chamado aberto com sucesso!', id };
        }
      }

      console.warn('⚠️ Falha na rota tool, tentando rota object...', err?.response?.status, err?.response?.data);
    }

    // ── Tentativa 2: rota Object (POST /api/object/suporte/ticket) ────────────
    try {
      const objectPayload = {
        id_cliente: ticketData.id_cliente,
        id_topico: ticketData.id_assunto,
        assunto: ticketData.mensagem.substring(0, 100),
        descricao: ticketData.mensagem,
        prioridade: ticketData.prioridade,
        setor: 'TECNICO',
      };
      const response = await this.client.post<any>('/api/object/suporte/ticket', objectPayload, { headers });
      const data = response.data;
      if (data && data.type !== 'error') {
        const id = data.id ?? data.dados?.id ?? '';
        console.log('✅ Ticket criado via /api/object/suporte/ticket. ID:', id);
        return { success: true, message: 'Chamado aberto com sucesso!', id: String(id) };
      }
      return { success: false, message: data?.message || 'Erro ao abrir chamado.' };
    } catch (error: any) {
      const msg = error.response?.data?.message || error.message || 'Erro de comunicação ao abrir chamado.';
      console.error('❌ Falha em ambas as rotas de criação de ticket:', msg);
      return { success: false, message: msg };
    }
  }

  // =====================================================================
  // PLANOS / PRODUTOS
  // =====================================================================

  async getAllVdPlanos(onProgress?: (total: number) => void): Promise<ISPFYPlanoData[]> {
    const endpoints = ['/vd_plano', '/plano', '/plano'];
    for (const endpoint of endpoints) {
      try {
        console.log(`Tentando buscar planos em: ${endpoint}`);
        const results = await this.fetchAllRecords<ISPFYPlanoData>(
          endpoint,
          { sort: 'id:ASC' },
          onProgress
        );
        if (results.length > 0) {
          console.log(`✅ Sucesso em ${endpoint}: ${results.length} planos.`);
          return results;
        }
      } catch {
        console.warn(`Falha em ${endpoint}, tentando próximo...`);
      }
    }
    return [];
  }

  async getAllPlanos(onProgress?: (total: number) => void): Promise<ISPFYPlanoData[]> {
    return this.fetchAllRecords<ISPFYPlanoData>(
      '/plano',
      { sort: 'descricao:ASC' },
      onProgress
    );
  }

  async getPlanoById(id: string): Promise<ISPFYPlanoData | null> {
    const response = await this.makeRequest<ISPFYPlanoData>('/plano', {
      filter: buildFilter('id', 'EQ', id),
      limit: 1,
    });
    const rows = this.getRows(response);
    return rows[0] ?? null;
  }

  async getPlanosAtivos(): Promise<ISPFYPlanoData[]> {
    if (this.cachedPlanos && this.cachedPlanos.length > 0) {
      return this.cachedPlanos;
    }
    try {
      const response = await this.makeRequest<ISPFYPlanoData>('/plano', {
        limit: 1000,
        sort: 'descricao:ASC',
      });
      const rows = this.getRows(response);
      if (rows && rows.length > 0) {
        this.cachedPlanos = rows;
        return rows;
      }
    } catch (err) {
      console.warn('Erro ao buscar planos ativos:', err);
    }
    return [];
  }

  /**
   * Resolução inteligente do plano do cliente a partir do contrato, login/ponto e lista de planos da empresa
   */
  resolveClientPlan(
    contrato?: Partial<ISPFYContratoData> | null,
    login?: Partial<ISPFYLoginData> | null,
    allPlanos?: ISPFYPlanoData[]
  ): string {
    // 1. Se o contrato ou login já contiver nome explícito válido
    if (contrato?.plano && !contrato.plano.startsWith('Contrato #')) return contrato.plano;
    if (contrato?.descricao && contrato.descricao !== 'Contrato' && !contrato.descricao.startsWith('Contrato #')) return contrato.descricao;
    if (login?.grupo_nome) return login.grupo_nome;

    const banda = (login?.banda_contratada || login?.banda || (login as any)?.banda_download || '').trim();
    const valor = parseFloat(String(contrato?.valor_mensal || contrato?.valor || '0'));

    // 2. Tenta casar por banda_limit e valor_mensal exato
    if (banda && valor > 0 && allPlanos && allPlanos.length > 0) {
      const exact = allPlanos.find(p =>
        p.banda_limit &&
        p.banda_limit.toLowerCase() === banda.toLowerCase() &&
        Math.abs(parseFloat(String(p.valor_mensal || p.valor || '0')) - valor) < 2
      );
      if (exact) return exact.nome || exact.descricao || '';
    }

    // 3. Tenta casar por banda_limit isolada
    if (banda && allPlanos && allPlanos.length > 0) {
      const byBanda = allPlanos.find(p =>
        p.banda_limit && p.banda_limit.toLowerCase() === banda.toLowerCase()
      );
      if (byBanda) return byBanda.nome || byBanda.descricao || '';
    }

    // 4. Tenta casar por valor_mensal isolado (se valor > 0 e plano não for 0)
    if (valor > 0 && allPlanos && allPlanos.length > 0) {
      const byValor = allPlanos.find(p =>
        p.id !== '1008' &&
        Math.abs(parseFloat(String(p.valor_mensal || p.valor || '0')) - valor) < 1
      );
      if (byValor) return byValor.nome || byValor.descricao || '';
    }

    // 5. Extração amigável de velocidade se houver banda_contratada (ex: "350000K/700000K" -> "FIBRA 700 MEGA")
    if (banda) {
      const parts = banda.split('/');
      const dlStr = parts[1] || parts[0];
      const match = dlStr.match(/(\d+)\s*([KkMmGg])/);
      if (match) {
        let num = parseInt(match[1], 10);
        const unit = match[2].toUpperCase();
        if (unit === 'K') num = Math.round(num / 1000);
        return `FIBRA ${num} MEGA`;
      }
    }

    return '';
  }

  /**
   * Helper completo para buscar contratos, logins e identificar o plano do cliente
   */
  async getClientPlanDetails(idCliente: string): Promise<{
    planName: string;
    activeContrato: ISPFYContratoData | null;
    activeLogin: ISPFYLoginData | null;
    contratos: ISPFYContratoData[];
    logins: ISPFYLoginData[];
    allPlanos: ISPFYPlanoData[];
  }> {
    const [allPlanos, contratos, logins] = await Promise.all([
      this.getPlanosAtivos().catch(() => [] as ISPFYPlanoData[]),
      this.getContratosByCliente(idCliente).catch(() => [] as ISPFYContratoData[]),
      this.getLoginsByCliente(idCliente).catch(() => [] as ISPFYLoginData[]),
    ]);

    const activeContrato = contratos.find(
      ct => ct.contrato_ativo === 's' || ct.contrato_ativo === 'S' || ct.status === 'A' || ct.status_internet === 'A'
    ) || contratos[0] || null;

    const activeLogin = logins[0] || null;

    const planName = this.resolveClientPlan(activeContrato, activeLogin, allPlanos);

    return {
      planName,
      activeContrato,
      activeLogin,
      contratos,
      logins,
      allPlanos,
    };
  }

  // =====================================================================
  // EQUIPAMENTOS
  // =====================================================================

  async getEquipamentosByCliente(idCliente: string): Promise<ISPFYEquipamentoData[]> {
    const response = await this.makeRequest<ISPFYEquipamentoData>('/equipamento', {
      filter: buildFilter('id_cliente', 'EQ', idCliente),
      limit: 1000,
      sort: 'id:DESC',
    });
    return this.getRows(response);
  }

  // =====================================================================
  // LOGINS (PPPoE — cliente/contrato/ponto/sessoes)
  // =====================================================================

  async getLoginsByCliente(idCliente: string): Promise<ISPFYLoginData[]> {
    try {
      const contratosResponse = await this.makeRequest<ISPFYContratoData>('/cliente/contrato', {
        filter: buildFilter('id_cliente', 'EQ', idCliente),
        limit: 50,
      });
      const contratos = this.getRows(contratosResponse);
      if (!contratos || contratos.length === 0) return [];

      const logins: ISPFYLoginData[] = [];
      for (const contrato of contratos) {
        if (!contrato.id) continue;
        try {
          const pontoResponse = await this.makeRequest<ISPFYLoginData>('/cliente/contrato/ponto', {
            filter: buildFilter('id_contrato', 'EQ', contrato.id),
            limit: 50,
          });
          logins.push(...this.getRows(pontoResponse));
        } catch (err) {
          console.error(`Erro ao buscar ponto do contrato ${contrato.id}:`, err);
        }
      }
      return logins;
    } catch (err) {
      console.error('Erro ao buscar contratos do cliente para logins:', err);
      return [];
    }
  }

  async getLoginsComCoordenadas(): Promise<ISPFYLoginData[]> {
    const response = await this.makeRequest<ISPFYLoginData>('/cliente/contrato/ponto/sessoes', {
      filter: buildFilter('online', 'EQ', 'S'),
      limit: 1000,
    });
    return this.getRows(response).filter((l) => {
      const lat = parseFloat(String(l.latitude || '').replace(',', '.'));
      const lng = parseFloat(String(l.longitude || '').replace(',', '.'));
      return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
    });
  }

  async fetchAllLoginsComCoordenadas(
    onProgress?: (total: number) => void
  ): Promise<ISPFYLoginData[]> {
    const logins = await this.fetchAllRecords<ISPFYLoginData>(
      '/cliente/contrato/ponto/sessoes',
      { filter: buildFilter('online', 'EQ', 'S') },
      onProgress
    );
    return logins.filter((l) => {
      const lat = parseFloat(String(l.latitude || '').replace(',', '.'));
      const lng = parseFloat(String(l.longitude || '').replace(',', '.'));
      return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
    });
  }

  async fetchAllLogins(onProgress?: (total: number) => void): Promise<ISPFYLoginData[]> {
    return this.fetchAllRecords<ISPFYLoginData>('/cliente/contrato/ponto/sessoes', { sort: 'id:DESC' }, onProgress);
  }

  async updateWifi(
    idLogin: string,
    ssid: string,
    password: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      console.log(`🌐 Atualizando Wi-Fi para login ID ${idLogin}...`);
      await this.writeRequest('put', `/cliente/contrato/ponto/${idLogin}`, { login: ssid, senha: password });
      return { success: true, message: 'Wi-Fi atualizado com sucesso!' };
    } catch (error: any) {
      return { success: false, message: error.response?.data?.message || 'Erro ao atualizar Wi-Fi.' };
    }
  }

  // =====================================================================
  // CONEXÕES ATIVAS (cliente/contrato/ponto/sessoes)
  // =====================================================================

  async getConexoesAtivas(idCliente?: string): Promise<ISPFYConexaoData[]> {
    const params: ISPFYQueryParams = {
      limit: 1000,
      sort: 'id:DESC',
    };
    if (idCliente) params.filter = buildFilter('id_cliente', 'EQ', idCliente);

    const response = await this.makeRequest<ISPFYConexaoData>('/cliente/contrato/ponto/sessoes', params);
    return this.getRows(response);
  }

  async desconectarCliente(
    idLogin: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      console.log(`🔌 Tentando desconectar login ID: ${idLogin}...`);
      const response = await this.makeRequest<ISPFYConexaoData>('/cliente/contrato/ponto/sessoes', {
        filter: buildFilter('id_login', 'EQ', idLogin),
        limit: 10,
      });
      const conexoes = this.getRows(response);

      if (conexoes.length === 0) {
        return { success: false, message: 'Nenhuma conexão ativa encontrada.' };
      }

      let successCount = 0;
      for (const conexao of conexoes) {
        if (conexao.id) {
          await this.writeRequest('delete', `/cliente/contrato/ponto/sessoes/${conexao.id}`);
          successCount++;
        }
      }

      if (successCount > 0) {
        return { success: true, message: `${successCount} sessão(ões) desconectada(s) com sucesso.` };
      }
      return { success: false, message: 'Não foi possível encerrar as sessões.' };
    } catch (error: any) {
      return { success: false, message: error.response?.data?.message || 'Erro ao desconectar.' };
    }
  }

  async getDetalhesConexao(_idLogin: string): Promise<any> {
    return null;
  }

  // =====================================================================
  // INFRAESTRUTURA FTTH (geofiber/cto)
  // =====================================================================

  async getCaixasFTTH(): Promise<ISPFYCaixaData[]> {
    const response = await this.makeRequest<ISPFYCaixaData>('/geofiber/cto', {
      limit: 1000,
      sort: 'id:DESC',
    });
    return this.getRows(response);
  }

  async getCaixasComCoordenadas(): Promise<ISPFYCaixaData[]> {
    const caixas = await this.getCaixasFTTH();
    return caixas.filter((c) => {
      const lat = parseFloat(String(c.latitude || '').replace(',', '.'));
      const lng = parseFloat(String(c.longitude || '').replace(',', '.'));
      return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
    });
  }

  async fetchAllCaixasComCoordenadas(
    onProgress?: (total: number) => void
  ): Promise<ISPFYCaixaData[]> {
    const caixas = await this.fetchAllRecords<ISPFYCaixaData>(
      '/geofiber/cto',
      { sort: 'id:DESC' },
      onProgress
    );
    return caixas.filter((c) => {
      const lat = parseFloat(String(c.latitude || '').replace(',', '.'));
      const lng = parseFloat(String(c.longitude || '').replace(',', '.'));
      return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
    });
  }

  async getPostesComCoordenadas(): Promise<ISPFYPosteData[]> {
    try {
      const response = await this.makeRequest<ISPFYPosteData>('/poste', { limit: 1000 });
      return this.getRows(response).filter((p) => {
        const lat = parseFloat(String(p.latitude || '').replace(',', '.'));
        const lng = parseFloat(String(p.longitude || '').replace(',', '.'));
        return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
      });
    } catch {
      return [];
    }
  }

  async getPopsComCoordenadas(): Promise<ISPFYPopData[]> {
    try {
      const response = await this.makeRequest<ISPFYPopData>('/pop', { limit: 1000 });
      return this.getRows(response).filter((p) => {
        const lat = parseFloat(String(p.latitude || '').replace(',', '.'));
        const lng = parseFloat(String(p.longitude || '').replace(',', '.'));
        return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
      });
    } catch {
      return [];
    }
  }

  // =====================================================================
  // FINANCEIRO — Caixa e Movimentações
  // =====================================================================

  async getCashAccounts(): Promise<ISPFYFinancialCaixaData[]> {
    return this.fetchAllRecords<ISPFYFinancialCaixaData>('/carteira', { sort: 'id:ASC' });
  }

  async createCashAccount(name: string): Promise<{ success: boolean; message: string }> {
    try {
      await this.writeRequest('post', '/carteira', { descricao: name, ativo: 'S' });
      return { success: true, message: 'Caixa criado com sucesso!' };
    } catch (error: any) {
      return { success: false, message: error.response?.data?.message || 'Erro ao criar caixa.' };
    }
  }

  async getCashMovements(days: number = 30, idCaixa?: string): Promise<ISPFYCashMovementData[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split('T')[0];

    const filter = idCaixa
      ? andFilters(
          buildFilter('id_caixa', 'EQ', idCaixa),
          buildFilter('data', 'GTE', startDateStr)
        )
      : buildFilter('data', 'GTE', startDateStr);

    return this.fetchAllRecords<ISPFYCashMovementData>('/cliente/contrato/cobranca', {
      filter,
      sort: 'data:DESC',
    });
  }

  async createCashMovement(data: {
    id_caixa: string;
    tipo: 'E' | 'S';
    valor: string;
    historico: string;
    documento?: string;
  }): Promise<{ success: boolean; message: string }> {
    try {
      const payload = {
        ...data,
        data: new Date().toISOString().slice(0, 19).replace('T', ' '),
        status: 'C',
      };
      await this.writeRequest('post', '/cliente/contrato/cobranca', payload);
      return { success: true, message: 'Lançamento realizado com sucesso!' };
    } catch (error: any) {
      return { success: false, message: error.response?.data?.message || 'Erro ao realizar lançamento.' };
    }
  }

  async transferBetweenAccounts(
    fromId: string,
    toId: string,
    value: number
  ): Promise<{ success: boolean; message: string }> {
    try {
      const valueStr = value.toFixed(2);
      await this.createCashMovement({
        id_caixa: fromId,
        tipo: 'S',
        valor: valueStr,
        historico: `Saída p/ Transferência -> Caixa ${toId}`,
        documento: 'TRANSF',
      });
      await this.createCashMovement({
        id_caixa: toId,
        tipo: 'E',
        valor: valueStr,
        historico: `Entrada vinda de Transferência <- Caixa ${fromId}`,
        documento: 'TRANSF',
      });
      return { success: true, message: 'Transferência concluída com sucesso!' };
    } catch (error: any) {
      return { success: false, message: 'Falha ao processar transferência.' };
    }
  }

  async getAccountsPayable(days: number = 30): Promise<ISPFYPayableData[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split('T')[0];

    return this.fetchAllRecords<ISPFYPayableData>('/cliente/contrato/cobranca', {
      filter: buildFilter('data_vencimento', 'GTE', startDateStr),
      sort: 'data_vencimento:DESC',
    });
  }

  // =====================================================================
  // FILIAIS
  // =====================================================================

  async getFiliais(): Promise<{ id: string; razao: string; nome_fantasia: string }[]> {
    const response = await this.makeRequest<{ id: string; razao: string; nome_fantasia: string }>(
      '/cidade',
      { limit: 100, sort: 'id:ASC' }
    );
    return this.getRows(response);
  }

  // =====================================================================
  // EDIÇÃO DE CLIENTE
  // =====================================================================

  async updateCliente(
    id: string,
    data: Partial<ISPFYClienteData>
  ): Promise<{ success: boolean; message: string }> {
    try {
      const response = await this.writeRequest<any>('put', `/cliente/${id}`, data as Record<string, unknown>);
      if (response?.type === 'error') {
        const msg = response.message?.replace(/<br \/>/g, ', ') || 'Erro de validação no ISPFY';
        return { success: false, message: msg };
      }
      return { success: true, message: 'Cliente atualizado com sucesso!' };
    } catch (error: any) {
      return { success: false, message: error.response?.data?.message || 'Erro ao atualizar cliente.' };
    }
  }

  // =====================================================================
  // UTILITÁRIOS
  // =====================================================================

  /**
   * Extrai todos os telefones válidos de um cliente (sem duplicatas)
   */
  getClientPhones(cliente: ISPFYClienteData): string[] {
    const phones: string[] = [];
    const seen = new Set<string>();

    const possiblePhones = [
      cliente.telefone_celular,
      cliente.fone_celular,
      cliente.fone_whatsapp,
      cliente.fone_residencial,
    ];

    possiblePhones.forEach((phone) => {
      if (phone && typeof phone === 'string' && phone.trim()) {
        const cleaned = phone.replace(/\D/g, '');
        if (cleaned.length >= 10 && !seen.has(cleaned)) {
          seen.add(cleaned);
          phones.push(cleaned);
        }
      }
    });

    return phones;
  }

  /**
   * Consumo de banda (simulado — integração real depende do endpoint de monitoramento)
   */
  async getBandwidthUsage(_idLogin: string): Promise<ISPFYUsageSeries[]> {
    const series: ISPFYUsageSeries[] = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      series.push({
        date: `${d.getDate()}/${d.getMonth() + 1}`,
        download: Math.floor(Math.random() * 50) + 10,
        upload: Math.floor(Math.random() * 10) + 2,
      });
    }
    return series;
  }

  // =====================================================================
  // AUDITORIA DE CLIENTES (Cadastrados, Cancelados e Excluídos do Mês)
  // =====================================================================

  private async fetchAllWithUnlimitedFallback<T>(
    endpoint: string,
    params: ISPFYQueryParams = {}
  ): Promise<T[]> {
    try {
      const response = await this.makeRequest<T>(endpoint, {
        ...params,
        limit: -1,
        pagination: 'FALSE',
      });
      return this.getRows(response);
    } catch (err) {
      console.warn(
        `[Auditoria] Fallback paginado em ${endpoint} após falha de limit=-1:`,
        err
      );
      const all: T[] = [];
      let offset = 0;
      while (true) {
        const pageResp = await this.makeRequest<T>(endpoint, {
          ...params,
          limit: 300,
          offset,
        });
        const rows = this.getRows(pageResp);
        all.push(...rows);
        if (rows.length < 300 || rows.length === 0) break;
        offset += 300;
      }
      return all;
    }
  }

  private async fetchByIds<T>(
    endpoint: string,
    filterField: string,
    ids: string[],
    sort?: string
  ): Promise<T[]> {
    const uniqueIds = Array.from(
      new Set(ids.map((id) => String(id || '').trim()).filter(Boolean))
    );
    if (uniqueIds.length === 0) return [];

    const chunkSize = 150;
    const allRows: T[] = [];

    for (let i = 0; i < uniqueIds.length; i += chunkSize) {
      const chunk = uniqueIds.slice(i, i + chunkSize);
      try {
        const rows = await this.fetchAllWithUnlimitedFallback<T>(endpoint, {
          filter: `${filterField}:IN:${chunk.join(',')}`,
          ...(sort ? { sort } : {}),
        });
        allRows.push(...rows);
      } catch (err) {
        console.warn(
          `[Auditoria] Erro ao buscar lote ${endpoint} (${filterField}:IN):`,
          err
        );
      }
    }

    return allRows;
  }

  private pickBestPhoneFromContatos(
    client: ISPFYClienteData | undefined,
    contatos: any[]
  ): string {
    const candidates: { phone: string; score: number }[] = [];

    for (const c of contatos) {
      const raw = String(
        c?.contato || c?.valor || c?.numero || c?.telefone || c?.fone || c?.celular || ''
      ).trim();
      if (!raw || raw.includes('@')) continue;

      const digits = raw.replace(/\D/g, '');
      if (digits.length < 8) continue;

      const tipo = String(c?.tipo || c?.descricao || '').toLowerCase();
      if (tipo.includes('email')) continue;

      let score = 1;
      if (tipo.includes('whats')) score += 4;
      else if (tipo.includes('cel')) score += 3;
      if (String(c?.principal || '').toLowerCase() === 's') score += 2;
      if (digits.length >= 11 && digits[2] === '9') score += 1;
      if (String(c?.ativo || 's').toLowerCase() === 'n') score -= 3;

      candidates.push({ phone: raw, score });
    }

    if (candidates.length > 0) {
      candidates.sort((a, b) => b.score - a.score);
      return candidates[0].phone;
    }

    return String(
      client?.fone_whatsapp ||
        client?.fone_celular ||
        client?.telefone_celular ||
        client?.telefone ||
        client?.celular ||
        ''
    ).trim();
  }

  private async ensureCitiesCached(clients: ISPFYClienteData[]): Promise<void> {
    const missingCityIds = Array.from(
      new Set(
        clients
          .map((c) =>
            String(
              (c as any)?.endereco_cobranca_id_cidade ||
                (c as any)?.id_cidade ||
                ''
            ).trim()
          )
          .filter((id) => id && !this.cachedCidadesMap.has(id))
      )
    );

    if (missingCityIds.length === 0) return;

    const cidades = await this.fetchByIds<any>('/cidade', 'id', missingCityIds);
    for (const city of cidades) {
      const id = String(city?.id || '').trim();
      const nome = String(city?.nome || city?.cidade || city?.descricao || '').trim();
      const uf = String(city?.uf || city?.estado || '').trim();
      if (id && nome) {
        this.cachedCidadesMap.set(id, uf ? `${nome}/${uf}` : nome);
      }
    }
  }

  private resolveClientCity(client?: ISPFYClienteData): string {
    if (!client) return '';
    const inlineCity = String(client.cidade || '').trim();
    if (inlineCity && !/^\d+$/.test(inlineCity)) return inlineCity;

    const cityId = String(
      (client as any)?.endereco_cobranca_id_cidade ||
        (client as any)?.id_cidade ||
        inlineCity
    ).trim();
    return cityId ? this.cachedCidadesMap.get(cityId) || '' : '';
  }

  private resolveContractPlanName(
    contrato: ISPFYContratoData | undefined,
    pontos: any[],
    pontoPlanosByPonto: Map<string, any[]>,
    planoById: Map<string, ISPFYPlanoData>,
    allPlanos: ISPFYPlanoData[]
  ): string {
    const sortedPontos = [...pontos].sort((a, b) => {
      const aActive = String(a?.ativo ?? a?.status ?? '').toLowerCase() !== 'n' ? 1 : 0;
      const bActive = String(b?.ativo ?? b?.status ?? '').toLowerCase() !== 'n' ? 1 : 0;
      if (aActive !== bActive) return bActive - aActive;
      return Number(b?.id || 0) - Number(a?.id || 0);
    });

    for (const pt of sortedPontos) {
      const ptPlanos = pontoPlanosByPonto.get(String(pt?.id || '')) || [];
      const sortedPtPlanos = [...ptPlanos].sort(
        (a, b) => Number(b?.id || 0) - Number(a?.id || 0)
      );
      for (const pp of sortedPtPlanos) {
        const planoObj = planoById.get(String(pp?.id_plano || ''));
        const nomePlano = String(
          planoObj?.nome || planoObj?.descricao || pp?.descricao || pp?.nome || ''
        ).trim();
        if (nomePlano) return nomePlano;
      }
    }

    return this.resolveClientPlan(contrato, sortedPontos[0], allPlanos);
  }

  private computeGapAnalysis(
    allClientes: ISPFYClienteData[],
    snapshotDeleted: ISPFYAuditDeletedRecord[],
    dataInicio: string,
    dataFim: string
  ): {
    excluidosPeriodo: ISPFYAuditDeletedRecord[];
    lacunasHistoricas: ISPFYAuditDeletedRecord[];
    maiorIdBase: number;
  } {
    const idToClientMap = new Map<number, ISPFYClienteData>();
    let maxId = 0;

    for (const c of allClientes) {
      const n = parseInt(String(c.id || ''), 10);
      if (!isNaN(n) && n > 0) {
        idToClientMap.set(n, c);
        if (n > maxId) maxId = n;
      }
    }

    const sortedPresentIds = Array.from(idToClientMap.keys()).sort((a, b) => a - b);
    const snapshotMap = new Map<string, ISPFYAuditDeletedRecord>();
    snapshotDeleted.forEach((rec) => snapshotMap.set(String(rec.id), rec));

    const lacunasHistoricas: ISPFYAuditDeletedRecord[] = [];
    const excluidosPeriodo: ISPFYAuditDeletedRecord[] = [];
    const seenIds = new Set<string>();

    const isInPeriod = (dateStr?: string) => {
      const d = String(dateStr || '').slice(0, 10);
      return Boolean(d && d >= dataInicio && d <= dataFim);
    };

    // Percorre todas as lacunas reais entre 1 e maxId usando os vizinhos globais da base
    for (let i = 0; i < sortedPresentIds.length; i++) {
      const currId = sortedPresentIds[i];
      const prevId = i === 0 ? 0 : sortedPresentIds[i - 1];
      if (currId - prevId <= 1) continue;

      const prevClient = prevId > 0 ? idToClientMap.get(prevId) : undefined;
      const nextClient = idToClientMap.get(currId);
      const prevDate = String(prevClient?.data_cadastro || '').slice(0, 10);
      const nextDate = String(nextClient?.data_cadastro || '').slice(0, 10);

      const refPrev = prevClient
        ? {
            id: String(prevClient.id),
            nome: prevClient.nome_razao || prevClient.nome || '',
            data_cadastro: prevClient.data_cadastro || '',
          }
        : undefined;
      const refNext = nextClient
        ? {
            id: String(nextClient.id),
            nome: nextClient.nome_razao || nextClient.nome || '',
            data_cadastro: nextClient.data_cadastro || '',
          }
        : undefined;

      const gapBelongsToPeriod =
        isInPeriod(prevDate) ||
        isInPeriod(nextDate) ||
        Boolean(prevDate && nextDate && prevDate < dataInicio && nextDate > dataFim);

      for (let missingId = currId - 1; missingId > prevId; missingId--) {
        const missingIdStr = String(missingId);
        seenIds.add(missingIdStr);
        const snapRec = snapshotMap.get(missingIdStr);

        const record: ISPFYAuditDeletedRecord = snapRec
          ? {
              ...snapRec,
              referencia_anterior: snapRec.referencia_anterior || refPrev,
              referencia_posterior: snapRec.referencia_posterior || refNext,
            }
          : {
              id: missingIdStr,
              tipo: 'gap_sequencial',
              referencia_anterior: refPrev,
              referencia_posterior: refNext,
              provavel_data: nextClient?.data_cadastro || prevClient?.data_cadastro || '',
              motivo: `ID #${missingIdStr} ausente na base do ISPFY (entre #${refPrev?.id || '?'} ${refPrev?.nome || 'Início da base'} e #${refNext?.id || '?'} ${refNext?.nome || 'ID posterior'}).`,
            };

        lacunasHistoricas.push(record);

        const snapInPeriod = snapRec
          ? isInPeriod(snapRec.detectado_em) || isInPeriod(snapRec.provavel_data)
          : false;

        if (snapInPeriod || gapBelongsToPeriod) {
          excluidosPeriodo.push(record);
        }
      }
    }

    // Inclui eventual registro de snapshot com ID maior que o maxId atual (ex: último ID recém-excluído)
    for (const snapRec of snapshotDeleted) {
      if (seenIds.has(snapRec.id)) continue;
      lacunasHistoricas.push(snapRec);
      if (isInPeriod(snapRec.detectado_em) || isInPeriod(snapRec.provavel_data)) {
        excluidosPeriodo.push(snapRec);
      }
    }

    lacunasHistoricas.sort((a, b) => Number(b.id) - Number(a.id));
    excluidosPeriodo.sort((a, b) => Number(b.id) - Number(a.id));

    return {
      excluidosPeriodo,
      lacunasHistoricas,
      maiorIdBase: maxId,
    };
  }

  /**
   * Obtém os dados consolidados e reais de auditoria para um determinado mês e ano:
   * - Clientes cadastrados no período (enriquecidos com plano real, cidade e telefone)
   * - Contratos rescindidos no período + tickets de remoção de equipamentos (tópico 7)
   * - Clientes excluídos (snapshot persistente na nuvem + lacunas de sequência globais)
   * - Resumo com saldo líquido, MRR e ranking de atendentes
   */
  async getAuditData(
    ano: number,
    mes: number,
    onProgress?: (step: string) => void,
    forceRefresh = false
  ): Promise<ISPFYAuditData> {
    const pad = (n: number) => String(n).padStart(2, '0');
    const lastDay = new Date(ano, mes, 0).getDate();
    const dataInicio = `${ano}-${pad(mes)}-01`;
    const dataFim = `${ano}-${pad(mes)}-${pad(lastDay)}`;
    const dateOnly = (val?: string) => String(val || '').slice(0, 10);

    // 1. Base completa de clientes e contratos (sem truncamento de paginação, com cache de 2 min)
    const cacheValid =
      !forceRefresh &&
      this.auditBaseCache &&
      Date.now() - this.auditBaseCache.fetchedAt < 2 * 60 * 1000;

    let allClientes: ISPFYClienteData[];
    let allContratos: ISPFYContratoData[];

    if (cacheValid && this.auditBaseCache) {
      allClientes = this.auditBaseCache.clientes;
      allContratos = this.auditBaseCache.contratos;
    } else {
      onProgress?.('Carregando base completa de clientes e contratos do ISPFY...');
      [allClientes, allContratos] = await Promise.all([
        this.fetchAllWithUnlimitedFallback<ISPFYClienteData>('/cliente', {
          sort: 'id:ASC',
        }),
        this.fetchAllWithUnlimitedFallback<ISPFYContratoData>('/cliente/contrato', {
          sort: 'id:DESC',
        }),
      ]);
      this.auditBaseCache = {
        fetchedAt: Date.now(),
        clientes: allClientes,
        contratos: allContratos,
      };
    }

    const clientById = new Map<string, ISPFYClienteData>();
    allClientes.forEach((c) => {
      if (c.id) clientById.set(String(c.id), c);
    });

    const contractsByClient = new Map<string, ISPFYContratoData[]>();
    allContratos.forEach((ct) => {
      const idCliente = String(ct.id_cliente || '').trim();
      if (!idCliente) return;
      const list = contractsByClient.get(idCliente) || [];
      list.push(ct);
      contractsByClient.set(idCliente, list);
    });

    // 2. Filtrar cadastrados e contratos rescindidos no período
    const rawCadastrados = allClientes
      .filter((c) => {
        const d = dateOnly(c.data_cadastro);
        return Boolean(d && d >= dataInicio && d <= dataFim);
      })
      .sort((a, b) =>
        String(b.data_cadastro || '').localeCompare(String(a.data_cadastro || ''))
      );

    const rawContratosCancelados = allContratos
      .filter((ct) => {
        const d = dateOnly(ct.data_rescisao);
        return Boolean(d && d >= dataInicio && d <= dataFim);
      })
      .sort((a, b) =>
        String(b.data_rescisao || '').localeCompare(String(a.data_rescisao || ''))
      );

    // 3. Buscar tickets de remoção de equipamentos (tópico 7) no período
    onProgress?.('Verificando solicitações e tickets de retirada...');
    let rawTicketsTopico7: ISPFYTicketData[] = [];
    try {
      rawTicketsTopico7 = await this.fetchAllWithUnlimitedFallback<ISPFYTicketData>(
        '/suporte/ticket',
        {
          filter: 'id_topico:EQ:7',
          sort: 'id:DESC',
        }
      );
    } catch (err) {
      console.warn('[Auditoria] Erro ao buscar tickets tópico 7 (remoção):', err);
    }

    const canceladosClienteSet = new Set(
      rawContratosCancelados.map((ct) => String(ct.id_cliente || ''))
    );

    const ticketsPeriodoSemRescisao = rawTicketsTopico7.filter((tk) => {
      const dt = dateOnly(tk.data_abertura || tk.data_cadastro || '');
      if (!dt || dt < dataInicio || dt > dataFim) return false;
      const idCli = String(tk.id_cliente || '');
      return Boolean(idCli && !canceladosClienteSet.has(idCli));
    });

    // 4. Sincronizar snapshot persistente na nuvem (Firestore + fallback local) e apurar lacunas globais
    onProgress?.('Sincronizando snapshot na nuvem e analisando lacunas...');
    const snapshotResult = await syncAndDetectDeletedClients(allClientes);
    const { excluidosPeriodo, lacunasHistoricas, maiorIdBase } =
      this.computeGapAnalysis(
        allClientes,
        snapshotResult.deletedRecords,
        dataInicio,
        dataFim
      );

    // 5. Enriquecer em lote apenas os clientes e contratos envolvidos no relatório do período
    const involvedClientIds = new Set<string>();
    const involvedContratoIds = new Set<string>();

    const pickPrimaryContract = (idCliente: string): ISPFYContratoData | undefined => {
      const list = contractsByClient.get(idCliente) || [];
      if (list.length === 0) return undefined;
      const sorted = [...list].sort((a, b) => {
        const aActive = String(a.contrato_ativo || '').toLowerCase() === 's' ? 1 : 0;
        const bActive = String(b.contrato_ativo || '').toLowerCase() === 's' ? 1 : 0;
        if (aActive !== bActive) return bActive - aActive;
        return Number(b.id || 0) - Number(a.id || 0);
      });
      return sorted[0];
    };

    rawCadastrados.forEach((c) => {
      const cid = String(c.id || '');
      if (!cid) return;
      involvedClientIds.add(cid);
      const ct = pickPrimaryContract(cid);
      if (ct?.id) involvedContratoIds.add(String(ct.id));
    });

    rawContratosCancelados.forEach((ct) => {
      if (ct.id_cliente) involvedClientIds.add(String(ct.id_cliente));
      if (ct.id) involvedContratoIds.add(String(ct.id));
    });

    ticketsPeriodoSemRescisao.forEach((tk) => {
      const cid = String(tk.id_cliente || '');
      if (!cid) return;
      involvedClientIds.add(cid);
      const ct = pickPrimaryContract(cid);
      if (ct?.id) involvedContratoIds.add(String(ct.id));
    });

    onProgress?.('Resolvendo planos reais, cidades e telefones de contato...');
    const involvedClientsArray = Array.from(involvedClientIds)
      .map((id) => clientById.get(id))
      .filter((c): c is ISPFYClienteData => Boolean(c));

    const [contatos, pontos, allPlanos] = await Promise.all([
      this.fetchByIds<any>(
        '/cliente/contato',
        'id_cliente',
        Array.from(involvedClientIds)
      ),
      this.fetchByIds<any>(
        '/cliente/contrato/ponto',
        'id_contrato',
        Array.from(involvedContratoIds)
      ),
      this.getPlanosAtivos(),
      this.ensureCitiesCached(involvedClientsArray),
    ]);

    const pontoIds = pontos
      .map((p) => String(p?.id || '').trim())
      .filter(Boolean);
    const pontoPlanos = await this.fetchByIds<any>(
      '/cliente/contrato/ponto/planos',
      'id_ponto',
      pontoIds
    );

    const planoById = new Map<string, ISPFYPlanoData>();
    allPlanos.forEach((p) => {
      if (p.id) planoById.set(String(p.id), p);
    });

    const missingPlanoIds = Array.from(
      new Set(
        pontoPlanos
          .map((pp) => String(pp?.id_plano || '').trim())
          .filter((id) => id && !planoById.has(id))
      )
    );
    if (missingPlanoIds.length > 0) {
      const extraPlanos = await this.fetchByIds<ISPFYPlanoData>(
        '/plano',
        'id',
        missingPlanoIds
      );
      extraPlanos.forEach((p) => {
        if (p.id) planoById.set(String(p.id), p);
      });
    }

    const contatosByClient = new Map<string, any[]>();
    contatos.forEach((c) => {
      const cid = String(c?.id_cliente || '').trim();
      if (!cid) return;
      const list = contatosByClient.get(cid) || [];
      list.push(c);
      contatosByClient.set(cid, list);
    });

    const pontosByContrato = new Map<string, any[]>();
    pontos.forEach((p) => {
      const ctId = String(p?.id_contrato || '').trim();
      if (!ctId) return;
      const list = pontosByContrato.get(ctId) || [];
      list.push(p);
      pontosByContrato.set(ctId, list);
    });

    const pontoPlanosByPonto = new Map<string, any[]>();
    pontoPlanos.forEach((pp) => {
      const ptId = String(pp?.id_ponto || '').trim();
      if (!ptId) return;
      const list = pontoPlanosByPonto.get(ptId) || [];
      list.push(pp);
      pontoPlanosByPonto.set(ptId, list);
    });

    // 6. Montar listas finais enriquecidas
    onProgress?.('Consolidando auditoria do período...');
    const countActiveContracts = (idCliente: string): number =>
      (contractsByClient.get(idCliente) || []).filter(
        (c) => String(c.contrato_ativo || '').toLowerCase() === 's'
      ).length;

    let mrrAdicionado = 0;
    const cadastradosList: ISPFYAuditClient[] = rawCadastrados.map((c) => {
      const cid = String(c.id || '');
      const clientContracts = contractsByClient.get(cid) || [];
      const ct = pickPrimaryContract(cid);
      const valor = ct?.valor_mensal ? parseFloat(ct.valor_mensal) : 0;
      if (!isNaN(valor)) mrrAdicionado += valor;

      const planoNome = ct
        ? this.resolveContractPlanName(
            ct,
            pontosByContrato.get(String(ct.id)) || [],
            pontoPlanosByPonto,
            planoById,
            allPlanos
          )
        : '';

      return {
        id: cid,
        nome_razao: c.nome_razao || c.nome || '',
        cpf_cnpj: c.cpf_cnpj || c.cnpj_cpf || '',
        data_cadastro: c.data_cadastro || '',
        usuario_cadastrou: c.usuario_cadastrou || 'desconhecido',
        bairro: c.endereco_cobranca_bairro || c.bairro || '',
        cidade: this.resolveClientCity(c),
        rua: c.endereco_cobranca_rua || c.endereco || '',
        numero: c.endereco_cobranca_numero || '',
        status_contrato: ct?.status_contrato || (ct ? 'ativo' : 'sem_contrato'),
        contrato_ativo: ct?.contrato_ativo || (ct ? 's' : 'n'),
        plano: planoNome || (ct ? '' : 'Sem contrato vinculado'),
        valor_mensal: ct?.valor_mensal || '0.00',
        telefone: this.pickBestPhoneFromContatos(c, contatosByClient.get(cid) || []),
        contrato_id: ct?.id ? String(ct.id) : undefined,
        data_adesao: ct?.data_adesao || undefined,
        sem_contrato: clientContracts.length === 0,
      };
    });

    const canceladosList: ISPFYAuditCancelledContract[] = rawContratosCancelados.map((ct) => {
      const idCliente = String(ct.id_cliente || '');
      const clientInfo = clientById.get(idCliente);

      let diasAtivo: number | undefined;
      if (ct.data_adesao && ct.data_rescisao) {
        const d1 = new Date(ct.data_adesao).getTime();
        const d2 = new Date(ct.data_rescisao).getTime();
        if (!isNaN(d1) && !isNaN(d2) && d2 >= d1) {
          diasAtivo = Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
        }
      }

      const planoNome = this.resolveContractPlanName(
        ct,
        pontosByContrato.get(String(ct.id)) || [],
        pontoPlanosByPonto,
        planoById,
        allPlanos
      );

      return {
        id: String(ct.id || ''),
        id_cliente: idCliente,
        nome_cliente:
          clientInfo?.nome_razao || clientInfo?.nome || `Cliente #${idCliente}`,
        cpf_cnpj: clientInfo?.cpf_cnpj || clientInfo?.cnpj_cpf || '',
        data_adesao: ct.data_adesao,
        data_rescisao: ct.data_rescisao || '',
        contrato_ativo: ct.contrato_ativo || 'n',
        status_contrato: ct.status_contrato || 'cancelado',
        usuario_cadastrou:
          ct.usuario_cadastrou || clientInfo?.usuario_cadastrou || 'desconhecido',
        valor_mensal: ct.valor_mensal || '0.00',
        dias_ativo: diasAtivo,
        observacoes: ct.observacoes || '',
        telefone: this.pickBestPhoneFromContatos(
          clientInfo,
          contatosByClient.get(idCliente) || []
        ),
        cidade: this.resolveClientCity(clientInfo),
        bairro: clientInfo?.endereco_cobranca_bairro || clientInfo?.bairro || '',
        plano: planoNome,
        contratos_ativos_restantes: countActiveContracts(idCliente),
        origem: 'rescisao_formal',
      };
    });

    const ticketsRemocaoList: ISPFYAuditCancelledContract[] =
      ticketsPeriodoSemRescisao.map((tk) => {
        const idCliente = String(tk.id_cliente || '');
        const clientInfo = clientById.get(idCliente);
        const ct = pickPrimaryContract(idCliente);
        const tkDate = dateOnly(tk.data_abertura || tk.data_cadastro || '');
        const planoNome = ct
          ? this.resolveContractPlanName(
              ct,
              pontosByContrato.get(String(ct.id)) || [],
              pontoPlanosByPonto,
              planoById,
              allPlanos
            )
          : '';

        return {
          id: ct?.id ? String(ct.id) : `ticket-${tk.id}`,
          id_cliente: idCliente,
          nome_cliente:
            clientInfo?.nome_razao ||
            clientInfo?.nome ||
            tk.nome_cliente ||
            `Cliente #${idCliente}`,
          cpf_cnpj: clientInfo?.cpf_cnpj || clientInfo?.cnpj_cpf || '',
          data_adesao: ct?.data_adesao,
          data_rescisao: tkDate,
          contrato_ativo: ct?.contrato_ativo || 's',
          status_contrato: ct?.status_contrato || tk.status || 'ticket_remocao',
          usuario_cadastrou:
            tk.usuario_abertura ||
            clientInfo?.usuario_cadastrou ||
            'desconhecido',
          valor_mensal: ct?.valor_mensal || '0.00',
          observacoes:
            tk.assunto ||
            tk.mensagem ||
            tk.descricao ||
            'Ticket de remoção de equipamentos em comodato',
          telefone: this.pickBestPhoneFromContatos(
            clientInfo,
            contatosByClient.get(idCliente) || []
          ),
          cidade: this.resolveClientCity(clientInfo),
          bairro: clientInfo?.endereco_cobranca_bairro || clientInfo?.bairro || '',
          plano: planoNome,
          contratos_ativos_restantes: countActiveContracts(idCliente),
          ticket_id: String(tk.id || ''),
          data_abertura_ticket: tk.data_abertura || tk.data_cadastro || '',
          origem: 'ticket_remocao',
        };
      });

    // 7. Calcular métricas e ranking de atendentes
    const rankingMap = new Map<string, number>();
    cadastradosList.forEach((c) => {
      const user = c.usuario_cadastrou || 'desconhecido';
      rankingMap.set(user, (rankingMap.get(user) || 0) + 1);
    });

    const rankingAtendentes = Array.from(rankingMap.entries())
      .map(([usuario, cadastros]) => ({ usuario, cadastros }))
      .sort((a, b) => b.cadastros - a.cadastros);

    let mrrPerdido = 0;
    canceladosList.forEach((c) => {
      const val = parseFloat(c.valor_mensal || '0');
      if (!isNaN(val)) mrrPerdido += val;
    });

    const totalCadastrados = cadastradosList.length;
    const totalCancelados = canceladosList.length;
    const totalExcluidos = excluidosPeriodo.length;
    const saldoLiquido = totalCadastrados - totalCancelados - totalExcluidos;

    onProgress?.('Auditoria concluída com sucesso!');

    return {
      periodo: {
        ano,
        mes,
        inicio: dataInicio,
        fim: dataFim,
      },
      cadastrados: cadastradosList,
      cancelados: canceladosList,
      ticketsRemocao: ticketsRemocaoList,
      excluidos: excluidosPeriodo,
      lacunasHistoricas,
      resumo: {
        totalCadastrados,
        totalCancelados,
        totalExcluidos,
        totalTicketsRemocao: ticketsRemocaoList.length,
        saldoLiquido,
        mrrPerdido,
        mrrAdicionado,
        rankingAtendentes,
        totalBaseAtiva: allClientes.length,
        maiorIdBase: maiorIdBase,
        totalLacunasBase: lacunasHistoricas.length,
        snapshotCloudAtivo: snapshotResult.cloudActive,
        ultimaAtualizacaoSnapshot: snapshotResult.updatedAt,
      },
    };
  }

  // =====================================================================
  // MONITORAMENTO POR BAIRRO, RUA E CONEXÃO EM TEMPO REAL
  // =====================================================================

  /**
   * Carrega todos os pontos de instalação da base ISPFY enriquecidos com cliente,
   * contrato, telefone, plano, endereço normalizado (bairro/rua) e status real de conexão.
   */
  async getClientsByRegionAndStatus(
    onProgress?: (step: string) => void,
    forceRefresh = false
  ): Promise<ISPFYClientsByRegionResult> {
    if (
      !forceRefresh &&
      this.regionCache &&
      Date.now() - this.regionCache.fetchedAt < 60 * 1000
    ) {
      return this.regionCache.data;
    }

    onProgress?.('Carregando clientes, contratos e status de conexão no ISPFY...');

    const [
      allClientes,
      allContratos,
      allPontos,
      allContatos,
      allPontoPlanos,
      allPlanos,
      onlineSessoes,
    ] = await Promise.all([
      this.fetchAllWithUnlimitedFallback<ISPFYClienteData>('/cliente', {
        sort: 'id:ASC',
      }),
      this.fetchAllWithUnlimitedFallback<ISPFYContratoData>('/cliente/contrato', {
        sort: 'id:ASC',
      }),
      this.fetchAllWithUnlimitedFallback<any>('/cliente/contrato/ponto', {
        sort: 'id:ASC',
      }),
      this.fetchAllWithUnlimitedFallback<any>('/cliente/contato', {
        sort: 'id:ASC',
      }).catch(() => [] as any[]),
      this.fetchAllWithUnlimitedFallback<any>('/cliente/contrato/ponto/planos', {
        sort: 'id:ASC',
      }).catch(() => [] as any[]),
      this.getPlanosAtivos().catch(() => [] as ISPFYPlanoData[]),
      this.fetchAllWithUnlimitedFallback<any>('/cliente/contrato/ponto/sessoes', {
        filter: 'status:EQ:online',
      }).catch(() => [] as any[]),
    ]);

    // Atualiza também os caches compartilhados (auditoria e metadados para polling em tempo real)
    const now = Date.now();
    this.auditBaseCache = {
      fetchedAt: now,
      clientes: allClientes,
      contratos: allContratos,
    };
    this.regionMetadataCache = {
      fetchedAt: now,
      allClientes,
      allContatos,
      allPontoPlanos,
      allPlanos,
    };

    onProgress?.('Resolvendo cidades, planos e normalizando bairros e ruas...');

    await this.ensureCitiesCached([
      ...allClientes,
      ...allPontos.map((pt) => ({ id_cidade: pt?.id_cidade } as ISPFYClienteData)),
    ]);

    const result = this.buildRegionResultFromDatasets({
      allClientes,
      allContratos,
      allPontos,
      allContatos,
      allPontoPlanos,
      allPlanos,
      onlineSessoes,
    });

    this.regionCache = {
      fetchedAt: Date.now(),
      data: result,
    };

    onProgress?.('Monitoramento por bairro e rua carregado!');
    return result;
  }

  /**
   * Poll rápido em tempo real para o monitor global de quedas:
   * reusa metadados cadastrais em cache (10 min) e consulta apenas contratos, pontos e sessões online.
   */
  async pollRealtimeConnectionStatus(): Promise<ISPFYClientsByRegionResult> {
    const metadata = this.regionMetadataCache;
    if (!metadata || Date.now() - metadata.fetchedAt > 10 * 60 * 1000) {
      return this.getClientsByRegionAndStatus(undefined, true);
    }

    const [allContratos, allPontos, onlineSessoes] = await Promise.all([
      this.fetchAllWithUnlimitedFallback<ISPFYContratoData>('/cliente/contrato', {
        sort: 'id:ASC',
      }),
      this.fetchAllWithUnlimitedFallback<any>('/cliente/contrato/ponto', {
        sort: 'id:ASC',
      }),
      this.fetchAllWithUnlimitedFallback<any>('/cliente/contrato/ponto/sessoes', {
        filter: 'status:EQ:online',
      }).catch(() => [] as any[]),
    ]);

    this.auditBaseCache = {
      fetchedAt: Date.now(),
      clientes: metadata.allClientes,
      contratos: allContratos,
    };

    const result = this.buildRegionResultFromDatasets({
      allClientes: metadata.allClientes,
      allContratos,
      allPontos,
      allContatos: metadata.allContatos,
      allPontoPlanos: metadata.allPontoPlanos,
      allPlanos: metadata.allPlanos,
      onlineSessoes,
    });

    this.regionCache = {
      fetchedAt: Date.now(),
      data: result,
    };

    return result;
  }

  /**
   * Carrega cobranças em aberto vencidas e agrega clientes em atraso por dia e data de vencimento.
   */
  async getOverdueByDueDateSummary(
    regionRecords?: ISPFYClientRegionRecord[],
    forceRefresh = false
  ): Promise<ISPFYOverdueAnalyticsResult> {
    if (
      !forceRefresh &&
      this.overdueCache &&
      Date.now() - this.overdueCache.fetchedAt < 60 * 1000
    ) {
      return this.overdueCache.data;
    }

    const todayIso = getTodayLocalIsoDate();
    const cachedContratos =
      !forceRefresh &&
      this.auditBaseCache &&
      Date.now() - this.auditBaseCache.fetchedAt < 3 * 60 * 1000
        ? this.auditBaseCache.contratos
        : null;

    const [cobrancas, contratos] = await Promise.all([
      this.fetchAllWithUnlimitedFallback<ISPFYFaturaData>(
        '/cliente/contrato/cobranca',
        {
          filter: andFilters(
            buildFilter('status', 'EQ', 'aberto'),
            buildFilter('data_vencimento', 'LT', todayIso)
          ),
          sort: 'data_vencimento:ASC',
        }
      ),
      cachedContratos
        ? Promise.resolve(cachedContratos)
        : this.fetchAllWithUnlimitedFallback<ISPFYContratoData>(
            '/cliente/contrato',
            { sort: 'id:ASC' }
          ),
    ]);

    const result = buildOverdueAnalytics({
      cobrancas,
      contratos,
      clientes:
        this.auditBaseCache?.clientes || this.regionMetadataCache?.allClientes,
      regionRecords: regionRecords || this.regionCache?.data.records,
      todayIso,
    });

    this.overdueCache = {
      fetchedAt: Date.now(),
      data: result,
    };

    return result;
  }

  /**
   * Constrói o snapshot estruturado de pontos/bairros/ruas a partir dos datasets brutos.
   */
  private buildRegionResultFromDatasets(params: {
    allClientes: ISPFYClienteData[];
    allContratos: ISPFYContratoData[];
    allPontos: any[];
    allContatos: any[];
    allPontoPlanos: any[];
    allPlanos: ISPFYPlanoData[];
    onlineSessoes: any[];
  }): ISPFYClientsByRegionResult {
    const {
      allClientes,
      allContratos,
      allPontos,
      allContatos,
      allPontoPlanos,
      allPlanos,
      onlineSessoes,
    } = params;

    const clientById = new Map<string, ISPFYClienteData>();
    allClientes.forEach((c) => {
      if (c.id) clientById.set(String(c.id), c);
    });

    const contratoById = new Map<string, ISPFYContratoData>();
    allContratos.forEach((ct) => {
      if (ct.id) contratoById.set(String(ct.id), ct);
    });

    const contatosByClient = new Map<string, any[]>();
    allContatos.forEach((c) => {
      const cid = String(c?.id_cliente || '').trim();
      if (!cid) return;
      const list = contatosByClient.get(cid) || [];
      list.push(c);
      contatosByClient.set(cid, list);
    });

    const planoById = new Map<string, ISPFYPlanoData>();
    allPlanos.forEach((p) => {
      if (p.id) planoById.set(String(p.id), p);
    });

    const pontoPlanosByPonto = new Map<string, any[]>();
    allPontoPlanos.forEach((pp) => {
      const ptId = String(pp?.id_ponto || '').trim();
      if (!ptId) return;
      const list = pontoPlanosByPonto.get(ptId) || [];
      list.push(pp);
      pontoPlanosByPonto.set(ptId, list);
    });

    const onlineSessaoByPonto = new Map<string, any>();
    onlineSessoes.forEach((s) => {
      const ptId = String(s?.id_ponto || '').trim();
      if (ptId && String(s?.status || '').toLowerCase() === 'online') {
        onlineSessaoByPonto.set(ptId, s);
      }
    });

    // Passo 1: Normalizar e coletar variantes de escrita por Bairro e Rua (para unificar acentuação/abreviação)
    const bairroVariants = new Map<string, Map<string, number>>();
    const streetVariants = new Map<string, Map<string, number>>();

    const prepared = allPontos.map((pt) => {
      const pontoId = String(pt?.id || '');
      const contratoId = String(pt?.id_contrato || '');
      const contrato = contratoById.get(contratoId);
      const clienteId = String(contrato?.id_cliente || pt?.id_cliente || '');
      const cliente = clientById.get(clienteId);

      const rawBairro = String(
        pt?.bairro ||
          cliente?.endereco_cobranca_bairro ||
          cliente?.bairro ||
          ''
      ).trim();
      const rawRua = String(
        pt?.endereco ||
          cliente?.endereco_cobranca_rua ||
          cliente?.endereco ||
          ''
      ).trim();

      const bairroKey = normalizeBairroKey(rawBairro);
      const ruaKey = normalizeStreetKey(rawRua);

      if (bairroKey !== EMPTY_BAIRRO_KEY && rawBairro) {
        const variants = bairroVariants.get(bairroKey) || new Map<string, number>();
        variants.set(rawBairro, (variants.get(rawBairro) || 0) + 1);
        bairroVariants.set(bairroKey, variants);
      }

      const compositeStreetKey = `${bairroKey}::${ruaKey}`;
      if (ruaKey !== EMPTY_STREET_KEY && rawRua) {
        const variants = streetVariants.get(compositeStreetKey) || new Map<string, number>();
        variants.set(rawRua, (variants.get(rawRua) || 0) + 1);
        streetVariants.set(compositeStreetKey, variants);
      }

      return { pt, pontoId, contratoId, contrato, clienteId, cliente, bairroKey, ruaKey, rawBairro, rawRua };
    });

    const canonicalBairroLabel = new Map<string, string>();
    bairroVariants.forEach((variants, key) => {
      canonicalBairroLabel.set(key, pickBestVariantLabel(variants, EMPTY_BAIRRO_LABEL));
    });

    const canonicalStreetLabel = new Map<string, string>();
    streetVariants.forEach((variants, key) => {
      canonicalStreetLabel.set(key, pickBestVariantLabel(variants, EMPTY_STREET_LABEL));
    });

    // Passo 2: Construir lista final enriquecida
    const records: ISPFYClientRegionRecord[] = prepared.map(
      ({ pt, pontoId, contratoId, contrato, clienteId, cliente, bairroKey, ruaKey }) => {
        const bairroLabel =
          bairroKey === EMPTY_BAIRRO_KEY
            ? EMPTY_BAIRRO_LABEL
            : canonicalBairroLabel.get(bairroKey) || EMPTY_BAIRRO_LABEL;

        const ruaLabel =
          ruaKey === EMPTY_STREET_KEY
            ? EMPTY_STREET_LABEL
            : canonicalStreetLabel.get(`${bairroKey}::${ruaKey}`) || EMPTY_STREET_LABEL;

        const numero = String(
          pt?.numero || cliente?.endereco_cobranca_numero || ''
        ).trim();
        const complemento = String(
          pt?.complemento || cliente?.endereco_cobranca_complemento || ''
        ).trim();
        const cleanComplemento =
          /^(n[aã]o informado|n\/i|-)$/i.test(complemento) ? '' : complemento;

        const cep = String(
          pt?.cep || cliente?.endereco_cobranca_cep || cliente?.cep || ''
        ).trim();

        const cidade =
          this.resolveClientCity({
            id_cidade: pt?.id_cidade || cliente?.endereco_cobranca_id_cidade,
            cidade: cliente?.cidade,
          } as ISPFYClienteData) || '';

        const enderecoBase =
          ruaKey === EMPTY_STREET_KEY
            ? ''
            : numero
            ? `${ruaLabel}, ${numero}`
            : ruaLabel;
        const enderecoCompleto = [enderecoBase, cleanComplemento]
          .filter(Boolean)
          .join(' - ');

        const liveSession = onlineSessaoByPonto.get(pontoId);
        const sessaoConexaoStatus = String(
          liveSession?.status || pt?.sessao_conexao_status || 'offline'
        ).toLowerCase();

        const health = classifyPointConnectionHealth({
          contratoAtivo: contrato?.contrato_ativo,
          pontoAtivo: pt?.ativo,
          statusContrato: contrato?.status_contrato,
          poolSobreposta: pt?.ipv4_wan_pool_sobreposta,
          sessaoConexaoStatus,
        });

        const plano =
          this.resolveContractPlanName(
            contrato,
            [pt],
            pontoPlanosByPonto,
            planoById,
            allPlanos
          ) || '';

        return {
          pontoId,
          contratoId,
          clienteId,
          nome:
            String(
              cliente?.nome_razao ||
                cliente?.nome ||
                cliente?.razao ||
                `Cliente #${clienteId || pontoId}`
            ).trim(),
          cpfCnpj: String(cliente?.cpf_cnpj || cliente?.cnpj_cpf || '').trim(),
          telefone: this.pickBestPhoneFromContatos(
            cliente,
            contatosByClient.get(clienteId) || []
          ),
          bairroKey,
          bairroLabel,
          ruaKey,
          ruaLabel,
          numero,
          complemento: cleanComplemento,
          cep,
          cidade,
          enderecoCompleto: enderecoCompleto || bairroLabel,
          plano,
          valorMensal: String(contrato?.valor_mensal || '0.00'),
          usuarioPppoe: String(pt?.usuario || '').trim(),
          mac: String(pt?.mac || liveSession?.mac || '').trim(),
          nas: String(pt?.nas || liveSession?.ipv4_nas || '').trim(),
          ipAlocado: String(
            liveSession?.ipv4_wan_endereco_alocado ||
              pt?.sessao_ipv4_wan_endereco_alocado ||
              ''
          ).trim(),
          ipv6Alocado: String(
            liveSession?.ipv6_wan_prefixo_alocado ||
              pt?.sessao_ipv6_wan_prefixo_alocado ||
              ''
          ).trim(),
          bandaContratada: String(pt?.banda_contratada || '').trim(),
          sessaoConexaoStatus,
          connectionHealth: health.connectionHealth,
          isOnline: health.isOnline,
          isBlocked: health.isBlocked,
          isContractActive: health.isContractActive,
          ultimoLogin: String(
            liveSession?.sessao_login ||
              pt?.sessao_ultimo_login ||
              pt?.ultimo_login ||
              ''
          ).trim(),
          ultimoAccounting: String(
            liveSession?.sessao_ultimo_accounting ||
              pt?.sessao_ultimo_accounting ||
              ''
          ).trim(),
        };
      }
    );

    const activeRecords = records.filter((r) => r.isContractActive);
    const activeSummary = aggregateRegionSummaries(activeRecords);

    const result: ISPFYClientsByRegionResult = {
      records,
      bairros: activeSummary.bairros,
      ruas: activeSummary.ruas,
      fetchedAt: new Date().toISOString(),
      totals: {
        ...activeSummary.totals,
        totalPontos: records.length,
        inativos: records.length - activeRecords.length,
      },
    };

    return result;
  }

  /**
   * Consulta em tempo real os pontos de um cliente específico (/api/tool/assinante/ponto/status).
   */
  async getClientLivePointStatuses(
    idCliente: string
  ): Promise<ISPFYLivePointStatus[]> {
    const fetchTool = async () => {
      const response = await this.client.get<any>('/api/tool/assinante/ponto/status', {
        params: { id_cliente: idCliente },
      });
      if (
        typeof response.data === 'string' &&
        response.data.trim().startsWith('<')
      ) {
        if (this.client.defaults.baseURL !== ISPFYService.FALLBACK_PROXY_HOST) {
          this.client.defaults.baseURL = ISPFYService.FALLBACK_PROXY_HOST;
          const retry = await this.client.get<any>('/api/tool/assinante/ponto/status', {
            params: { id_cliente: idCliente },
          });
          return retry.data;
        }
        throw new Error('Proxy ISPFY retornou HTML em vez de JSON.');
      }
      return response.data;
    };

    const raw = await fetchTool();
    const rows = this.getRows<any>(raw);
    return rows.map((row) => ({
      idPonto: String(row?.id_ponto || ''),
      idContrato: String(row?.id_contrato || ''),
      nomePonto: row?.nome_ponto ? String(row.nome_ponto) : undefined,
      conexaoStatus: String(row?.conexao_status || 'offline').toLowerCase(),
      isBlocked: String(row?.bloqueado || '0') === '1',
      ipWan: row?.ipv4_atual_wan ? String(row.ipv4_atual_wan) : undefined,
      ipv6Wan: row?.ipv6_atual_wan ? String(row.ipv6_atual_wan) : undefined,
      ultimoLogin: row?.ultimo_login ? String(row.ultimo_login) : undefined,
      planoNome: row?.plano_contratado_nome
        ? String(row.plano_contratado_nome)
        : undefined,
      uploadMesKbytes: row?.upload_mes_kbytes
        ? Number(row.upload_mes_kbytes)
        : undefined,
      downloadMesKbytes: row?.download_mes_kbytes
        ? Number(row.download_mes_kbytes)
        : undefined,
    }));
  }
}

// Exportar instância única do serviço
export const ispfyService = new ISPFYService();
export default ispfyService;

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
  ISPFYCashMovementData
} from '@/types/ispfy';

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
  private client: AxiosInstance;
  private token: string;

  constructor() {
    const host = import.meta.env.VITE_ISPFY_HOST;
    const token = import.meta.env.VITE_ISPFY_TOKEN;

    if (!host) {
      throw new Error('Configuração ISPFY incompleta. Verifique VITE_ISPFY_HOST no arquivo .env.local');
    }

    // Cliente axios com baseURL apontando para o proxy Vite (/api/ispfy)
    // que redireciona para https://coopertecisp.com.br:8043
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
    return this.fetchAllRecords<ISPFYClienteData>(
      '/cliente',
      { filter: buildFilter('ativo', 'EQ', status), sort: 'id:DESC' },
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
      const ativos = await this.fetchAllClientesByStatus('S', (t) => onProgress?.(t));
      const inativos = await this.fetchAllClientesByStatus('N', (t) =>
        onProgress?.(ativos.length + t)
      );
      return [...ativos, ...inativos].sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
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
      { filter: buildFilter('status_contrato', 'EQ', 'CA'), sort: 'id:DESC' },
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
    const filter = buildFilter('status', 'EQ', 'A');
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
        buildFilter('status', 'EQ', 'A')
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
        filter: buildFilter('status', 'EQ', 'A'),
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
          buildFilter('status', 'EQ', 'R')
        ),
        sort: 'pagamento_data:DESC',
      },
      onProgress
    );
  }

  async sendEmailFatura(idFatura: string): Promise<boolean> {
    try {
      console.log(`📧 Enviando e-mail para fatura ${idFatura}...`);
      await this.writeRequest('post', `/cliente/contrato/cobranca/${idFatura}/email`, { id: idFatura });
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
      filter: buildFilter('status', 'EQ', 'A'),
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
    const openFaturas = faturas.filter((f) => f.status === 'A' && !f.pagamento_data);

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
    const response = await this.makeRequest<ISPFYPlanoData>('/plano', {
      filter: buildFilter('ativo', 'EQ', 'S'),
      limit: 1000,
      sort: 'descricao:ASC',
    });
    return this.getRows(response);
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
}

// Exportar instância única do serviço
export const ispfyService = new ISPFYService();
export default ispfyService;

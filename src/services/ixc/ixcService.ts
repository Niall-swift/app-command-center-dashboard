import axios, { AxiosInstance } from 'axios';
import type { 
  IXCContratoData, 
  IXCFaturaData, 
  IXCTicketData, 
  IXCPlanoData, 
  IXCEquipamentoData, 
  IXCConexaoData,
  IXCClienteData,
  IXCApiResponse
} from '@/types/ixc';

export interface IXCParams {
  qtype: string;
  query: string;
  oper: '=' | '>' | '<' | 'LIKE';
  page: string;
  rp: string;
  sortname: string;
  sortorder: 'asc' | 'desc';
}

class IXCService {
  private client: AxiosInstance;
  private encodedToken: string;

  constructor() {
    // Validar configuração
    const host = import.meta.env.VITE_IXC_HOST;
    const token = import.meta.env.VITE_IXC_TOKEN;

    if (!host) {
      throw new Error('Configuração IXC incompleta. Verifique a variável VITE_IXC_HOST no arquivo .env.local');
    }

    // Configuração da API para browser
    this.client = axios.create({
      baseURL: host,
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Codificar token para autenticação
    this.encodedToken = token ? btoa(token) : '';
  }

  private async makeRequest<T>(
    endpoint: string,
    data: Partial<IXCParams>
  ): Promise<T> {
    try {
      const response = await this.client.post<T>(endpoint, data, {
        headers: {
          'Authorization': `Basic ${this.encodedToken}`,
          'ixcsoft': 'listar',
        },
      });

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Erro na API IXC: ${error.message}`);
      }
      throw error;
    }
  }

  // Buscar cliente por CNPJ/CPF
  async getClienteByCnpjCpf(cnpjCpf: string): Promise<IXCClienteData | null> {
    const data: Partial<IXCParams> = {
      qtype: 'cliente.cnpj_cpf',
      query: cnpjCpf,
      oper: '=',
      page: '1',
      rp: '1000',
      sortname: 'cliente.id',
      sortorder: 'desc',
    };

    const response = await this.makeRequest<IXCApiResponse<IXCClienteData>>('/cliente', data);
    
    if (!response.registros || response.registros.length === 0) {
      return null;
    }

    return response.registros[0];
  }

  // Buscar cliente por nome
  async getClienteByNome(nome: string): Promise<IXCClienteData[]> {
    const data: Partial<IXCParams> = {
      qtype: 'cliente.nome',
      query: `%${nome}%`,
      oper: 'LIKE',
      page: '1',
      rp: '1000',
      sortname: 'cliente.nome',
      sortorder: 'asc',
    };

    const response = await this.makeRequest<IXCApiResponse>('/cliente', data);
    return response.registros || [];
  }

  // Buscar cliente por ID
  async getClienteById(id: string): Promise<IXCClienteData | null> {
    const data: Partial<IXCParams> = {
      qtype: 'cliente.id',
      query: id,
      oper: '=',
      page: '1',
      rp: '1',
      sortname: 'cliente.id',
      sortorder: 'desc',
    };

    const response = await this.makeRequest<IXCApiResponse>('/cliente', data);
    
    if (!response.registros || response.registros.length === 0) {
      return null;
    }

    return response.registros[0];
  }

  // Buscar todos os clientes (com paginação)
  async getAllClientes(
    page: number = 1,
    rp: number = 1000,
    sortname: string = 'cliente.id',
    sortorder: 'asc' | 'desc' = 'desc'
  ): Promise<IXCApiResponse> {
    const data: Partial<IXCParams> = {
      qtype: 'cliente.id',
      query: '', // Query vazia para buscar todos
      oper: 'LIKE', // LIKE funciona melhor que = para buscar todos
      page: page.toString(),
      rp: rp.toString(),
      sortname,
      sortorder,
    };

    return await this.makeRequest<IXCApiResponse>('/cliente', data);
  }

  // Buscar clientes por cidade
  async getClientesByCidade(cidade: string): Promise<IXCClienteData[]> {
    const data: Partial<IXCParams> = {
      qtype: 'cliente.cidade',
      query: `%${cidade}%`,
      oper: 'LIKE',
      page: '1',
      rp: '1000',
      sortname: 'cliente.cidade',
      sortorder: 'asc',
    };

    const response = await this.makeRequest<IXCApiResponse>('/cliente', data);
    return response.registros || [];
  }

  // Buscar clientes ativos
  async getClientesAtivos(): Promise<IXCClienteData[]> {
    const data: Partial<IXCParams> = {
      qtype: 'cliente.ativo',
      query: 'S',
      oper: '=',
      page: '1',
      rp: '1000',
      sortname: 'cliente.nome',
      sortorder: 'asc',
    };

    const response = await this.makeRequest<IXCApiResponse>('/cliente', data);
    return response.registros || [];
  }

  // Buscar leads (clientes potenciais)
  async getLeads(): Promise<IXCClienteData[]> {
    const data: Partial<IXCParams> = {
      qtype: 'cliente.lead',
      query: 'S',
      oper: '=',
      page: '1',
      rp: '1000',
      sortname: 'cliente.id',
      sortorder: 'desc',
    };

    const response = await this.makeRequest<IXCApiResponse<IXCClienteData>>('/cliente', data);
    return response.registros || [];
  }

  // Busca genérica personalizada
  async searchClientes(
    qtype: string,
    query: string,
    oper: '=' | '>' | '<' | 'LIKE' = 'LIKE',
    page: number = 1,
    rp: number = 100,
    sortname: string = 'cliente.id',
    sortorder: 'asc' | 'desc' = 'desc'
  ): Promise<IXCApiResponse> {
    const data: Partial<IXCParams> = {
      qtype,
      query,
      oper,
      page: page.toString(),
      rp: rp.toString(),
      sortname,
      sortorder,
    };

    return await this.makeRequest<IXCApiResponse<IXCClienteData>>('/cliente', data);
  }

  // Testar conexão com a API
  async testConnection(): Promise<boolean> {
    try {
      await this.getAllClientes(1, 1);
      return true;
    } catch (error) {
      console.error('Erro ao testar conexão com IXC:', error);
      return false;
    }
  }

  // ==================== MÉTODOS DE CONTRATOS ====================

  // Buscar contratos por cliente
  async getContratosByCliente(idCliente: string): Promise<IXCContratoData[]> {
    const data: Partial<IXCParams> = {
      qtype: 'cliente_contrato.id_cliente',
      query: idCliente,
      oper: '=',
      page: '1',
      rp: '1000',
      sortname: 'cliente_contrato.id',
      sortorder: 'desc',
    };

    const response = await this.makeRequest<IXCApiResponse>('/cliente_contrato', data);
    return response.registros || [];
  }

  // Buscar contrato por ID
  async getContratoById(id: string): Promise<IXCContratoData | null> {
    const data: Partial<IXCParams> = {
      qtype: 'cliente_contrato.id',
      query: id,
      oper: '=',
      page: '1',
      rp: '1',
      sortname: 'cliente_contrato.id',
      sortorder: 'desc',
    };

    const response = await this.makeRequest<IXCApiResponse>('/cliente_contrato', data);
    
    if (!response.registros || response.registros.length === 0) {
      return null;
    }

    return response.registros[0];
  }

  // Buscar contratos ativos
  async getContratosAtivos(): Promise<IXCContratoData[]> {
    const data: Partial<IXCParams> = {
      qtype: 'cliente_contrato.status',
      query: 'A',
      oper: '=',
      page: '1',
      rp: '1000',
      sortname: 'cliente_contrato.id',
      sortorder: 'desc',
    };

    const response = await this.makeRequest<IXCApiResponse>('/cliente_contrato', data);
    return response.registros || [];
  }

  // ==================== MÉTODOS DE FATURAS ====================

  // Buscar faturas por cliente
  async getFaturasByCliente(idCliente: string): Promise<IXCFaturaData[]> {
    const data: Partial<IXCParams> = {
      qtype: 'fn_areceber.id_cliente',
      query: idCliente,
      oper: '=',
      page: '1',
      rp: '1000',
      sortname: 'fn_areceber.data_vencimento',
      sortorder: 'desc',
    };

    const response = await this.makeRequest<IXCApiResponse<IXCFaturaData>>('/fn_areceber', data);
    return response.registros || [];
  }

  // Buscar faturas abertas (não pagas)
  async getFaturasAbertas(idCliente?: string): Promise<IXCFaturaData[]> {
    const data: Partial<IXCParams> = idCliente ? {
      qtype: 'fn_areceber.id_cliente',
      query: idCliente,
      oper: '=',
      page: '1',
      rp: '1000',
      sortname: 'fn_areceber.data_vencimento',
      sortorder: 'asc',
    } : {
      qtype: 'fn_areceber.status',
      query: 'A',
      oper: '=',
      page: '1',
      rp: '1000',
      sortname: 'fn_areceber.data_vencimento',
      sortorder: 'asc',
    };

    const response = await this.makeRequest<IXCApiResponse>('/fn_areceber', data);
    
    // Filtrar apenas faturas abertas
    const faturas = response.registros || [];
    return faturas.filter((f: IXCFaturaData) => !f.data_pagamento);
  }

  // Buscar fatura por ID
  async getFaturaById(id: string): Promise<IXCFaturaData | null> {
    const data: Partial<IXCParams> = {
      qtype: 'fn_areceber.id',
      query: id,
      oper: '=',
      page: '1',
      rp: '1',
      sortname: 'fn_areceber.id',
      sortorder: 'desc',
    };

    const response = await this.makeRequest<IXCApiResponse>('/fn_areceber', data);
    
    if (!response.registros || response.registros.length === 0) {
      return null;
    }

    return response.registros[0];
  }

  // Buscar faturas vencidas
  async getFaturasVencidas(): Promise<IXCFaturaData[]> {
    const hoje = new Date().toISOString().split('T')[0];
    
    const data: Partial<IXCParams> = {
      qtype: 'fn_areceber.data_vencimento',
      query: hoje,
      oper: '<',
      page: '1',
      rp: '1000',
      sortname: 'fn_areceber.data_vencimento',
      sortorder: 'desc',
    };

    const response = await this.makeRequest<IXCApiResponse>('/fn_areceber', data);
    
  // Filtrar apenas faturas não pagas
    const faturas = response.registros || [];
    return faturas.filter((f: IXCFaturaData) => !f.data_pagamento);
  }

  // Disparar envio de fatura por e-mail
  async sendEmailFatura(idFatura: string): Promise<boolean> {
    try {
      // Endpoint genérico de ações do sistema ou envio direto
      // Tenta rota padrão de envio de e-mail de boleto
      console.log(`📧 Enviando comando de e-mail para fatura ${idFatura}...`);
      
      const payload = {
        id: idFatura,
        type: 'pdf' // Força geração do PDF/Link
      };

      // Nota: A rota exata pode variar. Tentando put_email_boleto com base em padrões comuns
      // Se falhar, o serviço deve apenas logar e continuar
      await this.client.put(`/fn_areceber/${idFatura}/email`, payload, {
         headers: {
          'Authorization': `Basic ${this.encodedToken}`,
          'ixcsoft': 'listar' // Mantendo header padrão
        }
      });
      
      return true;
    } catch (error) {
      console.error(`Erro ao enviar e-mail da fatura ${idFatura}:`, error);
      // Retorna false mas não trava o processo, pois pode ser que o endpoint seja diferente
      return false;
    }
  }

  // ==================== MÉTODOS DE TICKETS ====================

  // Buscar tickets por cliente
  async getTicketsByCliente(idCliente: string): Promise<IXCTicketData[]> {
    const data: Partial<IXCParams> = {
      qtype: 'su_oss_chamado.id_cliente',
      query: idCliente,
      oper: '=',
      page: '1',
      rp: '1000',
      sortname: 'su_oss_chamado.id',
      sortorder: 'desc',
    };

    const response = await this.makeRequest<IXCApiResponse>('/su_oss_chamado', data);
    return response.registros || [];
  }

  // Buscar tickets abertos
  async getTicketsAbertos(): Promise<IXCTicketData[]> {
    const data: Partial<IXCParams> = {
      qtype: 'su_oss_chamado.status',
      query: 'Aberto',
      oper: 'LIKE',
      page: '1',
      rp: '1000',
      sortname: 'su_oss_chamado.id',
      sortorder: 'desc',
    };

    const response = await this.makeRequest<IXCApiResponse>('/su_oss_chamado', data);
    return response.registros || [];
  }

  // Buscar ticket por ID
  async getTicketById(id: string): Promise<IXCTicketData | null> {
    const data: Partial<IXCParams> = {
      qtype: 'su_oss_chamado.id',
      query: id,
      oper: '=',
      page: '1',
      rp: '1',
      sortname: 'su_oss_chamado.id',
      sortorder: 'desc',
    };

    const response = await this.makeRequest<IXCApiResponse>('/su_oss_chamado', data);
    
    if (!response.registros || response.registros.length === 0) {
      return null;
    }

    return response.registros[0];
  }

  // ==================== MÉTODOS DE PLANOS ====================

  // Buscar todos os planos
  async getAllPlanos(): Promise<IXCPlanoData[]> {
    const data: Partial<IXCParams> = {
      qtype: 'produto.id',
      query: '0',
      oper: '>',
      page: '1',
      rp: '1000',
      sortname: 'produto.descricao',
      sortorder: 'asc',
    };

    const response = await this.makeRequest<IXCApiResponse>('/produto', data);
    return response.registros || [];
  }

  // Buscar plano por ID
  async getPlanoById(id: string): Promise<IXCPlanoData | null> {
    const data: Partial<IXCParams> = {
      qtype: 'produto.id',
      query: id,
      oper: '=',
      page: '1',
      rp: '1',
      sortname: 'produto.id',
      sortorder: 'desc',
    };

    const response = await this.makeRequest<IXCApiResponse>('/produto', data);
    
    if (!response.registros || response.registros.length === 0) {
      return null;
    }

    return response.registros[0];
  }

  // Buscar planos ativos
  async getPlanosAtivos(): Promise<IXCPlanoData[]> {
    const data: Partial<IXCParams> = {
      qtype: 'produto.ativo',
      query: 'S',
      oper: '=',
      page: '1',
      rp: '1000',
      sortname: 'produto.descricao',
      sortorder: 'asc',
    };

    const response = await this.makeRequest<IXCApiResponse>('/produto', data);
    return response.registros || [];
  }

  // ==================== MÉTODOS DE EQUIPAMENTOS ====================

  // Buscar equipamentos por cliente
  async getEquipamentosByCliente(idCliente: string): Promise<IXCEquipamentoData[]> {
    const data: Partial<IXCParams> = {
      qtype: 'equipamento.id_cliente',
      query: idCliente,
      oper: '=',
      page: '1',
      rp: '1000',
      sortname: 'equipamento.id',
      sortorder: 'desc',
    };

    const response = await this.makeRequest<IXCApiResponse<IXCEquipamentoData>>('/equipamento', data);
    return response.registros || [];
  }

  // Buscar conexões ativas
  async getConexoesAtivas(idCliente?: string): Promise<IXCConexaoData[]> {
    const data: Partial<IXCParams> = idCliente ? {
      qtype: 'radpopconexao.id_cliente',
      query: idCliente,
      oper: '=',
      page: '1',
      rp: '1000',
      sortname: 'radpopconexao.id',
      sortorder: 'desc',
    } : {
      qtype: 'radpopconexao.id',
      query: '0',
      oper: '>',
      page: '1',
      rp: '1000',
      sortname: 'radpopconexao.id',
      sortorder: 'desc',
    };

    const response = await this.makeRequest<IXCApiResponse<IXCConexaoData>>('/radpopconexao', data);
    return response.registros || [];
  }
  // ==================== MÉTODOS DE BUSCA TOTAL (PAGINAÇÃO AUTOMÁTICA) ====================

  /**
   * Método genérico para busca recursiva de todos os registros
   */
  private async fetchAllRecords<T>(
    endpoint: string,
    params: Partial<IXCParams>,
    onProgress?: (total: number) => void
  ): Promise<T[]> {
    let allRecords: T[] = [];
    let page = 1;
    let hasMore = true;
    const rp = 1000;

    while (hasMore) {
      const data: Partial<IXCParams> = {
        ...params,
        page: page.toString(),
        rp: rp.toString(),
      };

      try {
        const response = await this.makeRequest<IXCApiResponse<T>>(endpoint, data);
        const registros = response.registros || [];
        
        allRecords = [...allRecords, ...registros];
        
        if (onProgress) {
          onProgress(allRecords.length);
        }

        if (registros.length < rp) {
          hasMore = false;
        } else {
          page++;
        }
      } catch (error) {
        console.error(`Erro ao buscar página ${page} de ${endpoint}:`, error);
        hasMore = false;
      }
    }
    return allRecords;
  }

  /**
   * Busca TODOS os clientes ATIVOS recursivamente
   * Filtra por cliente.ativo = 'S'
   */
  async fetchAllClientesAtivos(onProgress?: (total: number) => void): Promise<IXCClienteData[]> {
    return this.fetchAllRecords<IXCClienteData>(
      '/cliente',
      {
        qtype: 'cliente.ativo',
        query: 'S',
        oper: '=',
        sortname: 'cliente.id',
        sortorder: 'desc',
      },
      onProgress
    );
  }

  /**
   * Busca TODAS as faturas em aberto recursivamente
   */
  async fetchAllFaturasAbertas(
    onProgress?: (total: number) => void
  ): Promise<IXCFaturaData[]> {
    const faturas = await this.fetchAllRecords<IXCFaturaData>(
      '/fn_areceber',
      {
        qtype: 'fn_areceber.status',
        query: 'A', // Apenas abertas
        oper: '=',
        sortname: 'fn_areceber.data_vencimento',
        sortorder: 'asc',
      },
      onProgress
    );
    // Filtrar localmente para garantir que não tem data de pagamento (garantia extra)
    return faturas.filter(f => !f.data_pagamento);
  }

  /**
   * Busca contratos com bloqueio automático (bloqueio_automatico = 'S')
   */
  async fetchAllContratosBloqueados(
    onProgress?: (total: number) => void
  ): Promise<IXCContratoData[]> {
    return this.fetchAllRecords<IXCContratoData>(
      '/cliente_contrato',
      {
        qtype: 'cliente_contrato.status_internet',
        query: 'CA', // Status CA (Cancelamento Automático/Bloqueado)
        oper: '=',
        sortname: 'cliente_contrato.id',
        sortorder: 'desc',
      },
      onProgress
    );
  }
}

// Exportar instância única do serviço
export const ixcService = new IXCService();
export default IXCService;
import axios, { AxiosInstance } from 'axios';
import https from 'https';

export interface IXCParams {
  qtype: string;
  query: string;
  oper: '=' | '>' | '<' | 'LIKE';
  page: string;
  rp: string;
  sortname: string;
  sortorder: 'asc' | 'desc';
}

export interface IXCClienteData {
  id?: string;
  nome?: string;
  razao?: string;
  cnpj_cpf?: string;
  tipo_pessoa?: 'F' | 'J';
  fone_residencial?: string;
  fone_celular?: string;
  fone_whatsapp?: string;
  email?: string;
  endereco?: string;
  bairro?: string;
  cep?: string;
  cidade?: string;
  estado?: string;
  ativo?: 'S' | 'N';
  lead?: 'S' | 'N';
  obs?: string;
  [key: string]: unknown; // Para campos adicionais da API
}

export interface IXCApiResponse {
  registros: IXCClienteData[];
  total: number;
  page: number;
  rp: number;
  total_pages: number;
  query?: string;
  rows?: unknown[];
}

class IXCService {
  private client: AxiosInstance;
  private encodedToken: string;

  constructor() {
    // Configuração da API
    this.client = axios.create({
      baseURL: 'https://coopertecisp.com.br/webservice/v1',
      timeout: 15000,
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Token da API - pode ser movido para variáveis de ambiente
    const token = '29:ed30004f8207dbe08feb05005d67ea023793429a91210655cbf03fe12b1e4c94';
    this.encodedToken = this.stringToBase64(token);
  }

  private stringToBase64(str: string): string {
    const base64Chars =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let result = '';

    for (let i = 0; i < str.length; i += 3) {
      const chunk =
        (str.charCodeAt(i) << 16) |
        (str.charCodeAt(i + 1) << 8) |
        str.charCodeAt(i + 2);
      result +=
        base64Chars.charAt((chunk >> 18) & 0x3f) +
        base64Chars.charAt((chunk >> 12) & 0x3f) +
        base64Chars.charAt((chunk >> 6) & 0x3f) +
        base64Chars.charAt(chunk & 0x3f);
    }

    const padding = str.length % 3;
    if (padding === 1) {
      result = result.slice(0, -2) + '==';
    } else if (padding === 2) {
      result = result.slice(0, -1) + '=';
    }

    return result;
  }

  private async makeRequest<T>(
    endpoint: string,
    data: Partial<IXCParams>
  ): Promise<T> {
    try {
      const response = await this.client.post<T>(endpoint, {
        ...data,
        headers: {
          Authorization: `Basic ${this.encodedToken}`,
          ixcsoft: 'listar',
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

    const response = await this.makeRequest<IXCApiResponse>('/cliente', data);
    
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
    rp: number = 100,
    sortname: string = 'cliente.id',
    sortorder: 'asc' | 'desc' = 'desc'
  ): Promise<IXCApiResponse> {
    const data: Partial<IXCParams> = {
      qtype: 'cliente.id',
      query: '0',
      oper: '>',
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

    const response = await this.makeRequest<IXCApiResponse>('/cliente', data);
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

    return await this.makeRequest<IXCApiResponse>('/cliente', data);
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
}

// Exportar instância única do serviço
export const ixcService = new IXCService();
export default IXCService;
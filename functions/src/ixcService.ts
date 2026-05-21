import axios, { AxiosInstance } from 'axios';
import { IXCClienteData, IXCFaturaData, IXCApiResponse, IXCParams } from './ixcTypes';
import * as https from 'https';

export class IXCBackendService {
  private client: AxiosInstance;
  private encodedToken: string;

  constructor(host: string, token: string) {
    this.client = axios.create({
      baseURL: host,
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
      },
      httpsAgent: new https.Agent({
        rejectUnauthorized: false
      })
    });
    this.encodedToken = Buffer.from(token).toString('base64');
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
    } catch (error: any) {
      console.error(`Erro na API IXC (${endpoint}):`, error.message);
      throw error;
    }
  }

  async getClienteByPhone(phone: string): Promise<IXCClienteData | null> {
    console.log(`🔍 Iniciando busca no IXC para o telefone: ${phone}`);
    let cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.startsWith('55') && cleanPhone.length > 10) {
      cleanPhone = cleanPhone.substring(2);
    }
    
    const ddd = cleanPhone.slice(0, 2);
    const rest = cleanPhone.slice(2);
    let formattedCel = "";
    let formattedFix = "";
    
    if (rest.length === 9) {
      formattedCel = `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
      formattedFix = `(${ddd}) ${rest.slice(1, 5)}-${rest.slice(5)}`;
    } else if (rest.length === 8) {
      formattedCel = `(${ddd}) 9${rest.slice(0, 4)}-${rest.slice(4)}`;
      formattedFix = `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
    }

    const searchTerms = [formattedCel, formattedFix, `%${cleanPhone.slice(-8).split('').join('%')}%`].filter(t => t !== "");
    const fields = ['cliente.telefone_celular', 'cliente.fone_whatsapp', 'cliente.telefone', 'cliente.telefone_comercial'];

    const promises = [];
    for (const term of searchTerms) {
      for (const field of fields) {
        const data: Partial<IXCParams> = {
          qtype: field,
          query: term,
          oper: term.includes('%') ? 'LIKE' : '=',
          page: '1',
          rp: '1',
        };
        promises.push(
          this.makeRequest<IXCApiResponse<IXCClienteData>>('/cliente', data)
            .then(res => res.registros && res.registros.length > 0 ? res.registros[0] : null)
            .catch(() => null)
        );
      }
    }

    const results = await Promise.all(promises);
    const found = results.find(r => r !== null);
    return found || null;
  }

  async getClienteByCpfCnpj(cpfCnpj: string): Promise<IXCClienteData | null> {
    const numbers = cpfCnpj.replace(/\D/g, '');
    let formattedCpfCnpj = cpfCnpj;
    
    if (numbers.length === 11) {
      formattedCpfCnpj = numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    } else if (numbers.length === 14) {
      formattedCpfCnpj = numbers.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
    }

    console.log(`🔍 Buscando cliente por CPF/CNPJ: ${formattedCpfCnpj}`);
    
    const data: Partial<IXCParams> = {
      qtype: 'cliente.cnpj_cpf',
      query: formattedCpfCnpj,
      oper: '=',
      page: '1',
      rp: '1',
    };

    try {
      const response = await this.makeRequest<IXCApiResponse<IXCClienteData>>('/cliente', data);
      console.log(`📊 Resultado busca CPF/CNPJ (${formattedCpfCnpj}): Found ${response.registros?.length || 0} records`);
      return (response.registros && response.registros.length > 0) ? response.registros[0] : null;
    } catch (err: any) {
      console.error(`❌ Erro ao buscar CPF/CNPJ (${formattedCpfCnpj}):`, err.message);
      return null;
    }
  }

  async getFaturasAbertas(idCliente: string): Promise<IXCFaturaData[]> {
    const data: Partial<IXCParams> = {
      qtype: 'fn_areceber.id_cliente',
      query: idCliente,
      oper: '=',
      page: '1',
      rp: '10',
      sortname: 'fn_areceber.data_vencimento',
      sortorder: 'asc',
    };

    const response = await this.makeRequest<IXCApiResponse<IXCFaturaData>>('/fn_areceber', data);
    const faturas = response.registros || [];
    
    // Filtrar apenas faturas abertas (status 'A' e sem data de pagamento)
    return faturas.filter(f => f.status === 'A' && !f.data_pagamento);
  }

  async getBoleto(idFatura: string): Promise<string | null> {
    try {
      const response = await this.client.post<{ link: string }>(`/get_boleto/${idFatura}`, { id: idFatura }, {
        headers: { 'Authorization': `Basic ${this.encodedToken}` }
      });
      return response.data?.link || null;
    } catch (error) {
      return null;
    }
  }

  async getPix(idFatura: string): Promise<string | null> {
    try {
      const response = await this.client.post<{ qrcode_text: string }>(`/get_pix_qrcode/${idFatura}`, { id: idFatura }, {
        headers: { 'Authorization': `Basic ${this.encodedToken}` }
      });
      return response.data?.qrcode_text || null;
    } catch (error) {
      return null;
    }
  }

  async sendEmailFatura(idFatura: string): Promise<boolean> {
    try {
      console.log(`📧 Enviando comando de e-mail para fatura ${idFatura}...`);
      const payload = {
        id: idFatura,
        type: 'pdf'
      };
      await this.client.put(`/fn_areceber/${idFatura}/email`, payload, {
        headers: {
          'Authorization': `Basic ${this.encodedToken}`,
          'ixcsoft': 'listar'
        }
      });
      return true;
    } catch (error: any) {
      console.error(`Erro ao enviar e-mail da fatura ${idFatura}:`, error.message);
      return false;
    }
  }

  async getContratosByCliente(idCliente: string): Promise<any[]> {
    const data: Partial<IXCParams> = {
      qtype: 'cliente_contrato.id_cliente',
      query: idCliente,
      oper: '=',
      page: '1',
      rp: '10',
      sortname: 'cliente_contrato.id',
      sortorder: 'desc',
    };

    const response = await this.makeRequest<IXCApiResponse<any>>('/cliente_contrato', data);
    return response.registros || [];
  }

  async unlockContract(idContrato: string): Promise<{ success: boolean; message: string }> {
    try {
      console.log(`🔓 Tentando desbloquear contrato ID: ${idContrato}...`);
      const payload = { id: idContrato };

      const response = await this.client.post('/desbloqueio_confianca', payload, {
        headers: {
          'Authorization': `Basic ${this.encodedToken}`,
          'ixcsoft': 'inserir'
        }
      });
      
      console.log('📦 Resposta Desbloqueio (inserir):', response.data);
      
      const isSuccess = (data: any) => {
        if (Array.isArray(data) && data.length > 0) return true;
        if (!data) return false;
        if (data.type === 'error' || data.status === 'erro') return false;
        if (data.type === 'success' || data.status === 'sucesso' || (data.id && String(data.id).length > 0)) return true;
        return false;
      };

      if (isSuccess(response.data)) {
         return { success: true, message: Array.isArray(response.data) ? response.data[0] : (response.data.message || 'Contrato desbloqueado em confiança com sucesso!') };
      }

      // Fallback
      const responseListar = await this.client.post('/desbloqueio_confianca', payload, {
        headers: {
          'Authorization': `Basic ${this.encodedToken}`,
          'ixcsoft': 'listar'
        }
      });

      if (isSuccess(responseListar.data)) {
         return { success: true, message: Array.isArray(responseListar.data) ? responseListar.data[0] : (responseListar.data.message || 'Contrato desbloqueado em confiança com sucesso!') };
      }

      return { success: false, message: responseListar.data?.message || responseListar.data?.aviso || 'Não foi possível liberar a confiança no momento.' };
    } catch (error: any) {
      console.error('Erro ao desbloquear contrato:', error.message);
      const errorMsg = error.response?.data?.message || error.response?.data?.aviso || 'Erro ao processar desbloqueio. Verifique permissões.';
      return { success: false, message: errorMsg };
    }
  }
}

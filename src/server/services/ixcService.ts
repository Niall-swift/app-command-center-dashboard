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
    // Limpar telefone para busca
    const cleanPhone = phone.replace(/\D/g, '').slice(-9); // Pegar os últimos 9 dígitos para ser mais flexível
    
    // Tentar fone_whatsapp
    const data: Partial<IXCParams> = {
      qtype: 'cliente.fone_whatsapp',
      query: `%${cleanPhone}`,
      oper: 'LIKE',
      page: '1',
      rp: '1',
    };

    const response = await this.makeRequest<IXCApiResponse<IXCClienteData>>('/cliente', data);
    if (response.registros && response.registros.length > 0) {
      return response.registros[0];
    }

    // Tentar telefone_celular
    data.qtype = 'cliente.telefone_celular';
    const response2 = await this.makeRequest<IXCApiResponse<IXCClienteData>>('/cliente', data);
    if (response2.registros && response2.registros.length > 0) {
      return response2.registros[0];
    }

    return null;
  }

  async getClienteByCpfCnpj(cpfCnpj: string): Promise<IXCClienteData | null> {
    const cleanCpfCnpj = cpfCnpj.replace(/\D/g, '');
    console.log(`🔍 Buscando cliente por CPF/CNPJ: ${cleanCpfCnpj}`);
    
    const data: Partial<IXCParams> = {
      qtype: 'cliente.cnpj_cpf',
      query: `%${cleanCpfCnpj}%`, // Usar LIKE para ser mais flexível com formatação
      oper: 'LIKE',
      page: '1',
      rp: '1',
    };

    try {
      const response = await this.makeRequest<IXCApiResponse<IXCClienteData>>('/cliente', data);
      console.log(`📊 Resultado busca CPF/CNPJ (${cleanCpfCnpj}): Found ${response.registros?.length || 0} records`);
      return (response.registros && response.registros.length > 0) ? response.registros[0] : null;
    } catch (err: any) {
      console.error(`❌ Erro ao buscar CPF/CNPJ (${cleanCpfCnpj}):`, err.message);
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
}

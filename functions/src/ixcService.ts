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
      // Garantir que a chamada seja feita para a API (v1) e não para a URL base que pode retornar HTML
      let apiUrl = this.client.defaults.baseURL || "";
      if (apiUrl.endsWith('/api/ixc')) {
        apiUrl = apiUrl.replace('/api/ixc', ''); // Corrige caso o host tenha /api/ixc sobrando
      }
      
      const fullEndpoint = endpoint.startsWith('/webservice/v1') ? endpoint : `/webservice/v1${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
      
      const response = await axios.post<T>(`${apiUrl}${fullEndpoint}`, data, {
        timeout: 15000,
        httpsAgent: new https.Agent({ rejectUnauthorized: false }),
        headers: {
          'Authorization': `Basic ${this.encodedToken}`,
          'ixcsoft': 'listar',
          'Content-Type': 'application/json',
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
          oper: term.includes('%') ? 'L' : '=',
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

  async getClienteById(id: string): Promise<IXCClienteData | null> {
    const data: Partial<IXCParams> = {
      qtype: 'cliente.id',
      query: id,
      oper: '=',
      page: '1',
      rp: '1',
    };

    try {
      const response = await this.makeRequest<IXCApiResponse<IXCClienteData>>('/cliente', data);
      return (response.registros && response.registros.length > 0) ? response.registros[0] : null;
    } catch (err: any) {
      console.error(`❌ Erro ao buscar cliente por ID (${id}):`, err.message);
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
    
    const openFaturas = faturas.filter(f => f.status === 'A' && !f.data_pagamento);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const atrasadas: IXCFaturaData[] = [];
    const futuras: IXCFaturaData[] = [];

    for (const f of openFaturas) {
      let dueDate: Date;
      if (f.data_vencimento.includes("-")) {
        const [year, month, day] = f.data_vencimento.split("-");
        dueDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      } else {
        const [day, month, year] = f.data_vencimento.split("/");
        dueDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      }
      
      if (dueDate < today) {
        atrasadas.push(f);
      } else {
        futuras.push(f);
      }
    }

    // Se houver faturas atrasadas, retorna apenas as atrasadas
    if (atrasadas.length > 0) {
      return atrasadas;
    }

    // Caso contrário, retorna no máximo as 2 próximas faturas a vencer
    return futuras.slice(0, 2);
  }

  async getFaturasPagasHoje(): Promise<IXCFaturaData[]> {
    const today = new Date();
    const formattedDate = today.toISOString().split('T')[0]; // "YYYY-MM-DD"

    const data: Partial<IXCParams> = {
      qtype: 'fn_areceber.data_pagamento',
      query: formattedDate,
      oper: '=',
      page: '1',
      rp: '100', // Pega as últimas 100 do dia
    };

    try {
      const response = await this.makeRequest<IXCApiResponse<IXCFaturaData>>('/fn_areceber', data);
      const faturas = response.registros || [];
      // Filtra para garantir status Pago (P) ou Recebido (R)
      return faturas.filter(f => f.status === 'P' || f.status === 'R' || f.data_pagamento === formattedDate);
    } catch (error: any) {
      console.error("❌ Erro ao buscar faturas pagas hoje:", error.message);
      return [];
    }
  }

  async getBoleto(idFatura: string): Promise<string | null> {
    try {
      const response = await this.client.post<{ link: string }>(`/get_boleto/${idFatura}`, { id: idFatura }, {
        headers: { 'Authorization': `Basic ${this.encodedToken}` }
      });
      const link = response.data?.link;
      return (typeof link === 'string' && link.startsWith('http')) ? link : null;
    } catch (error) {
      return null;
    }
  }

  async getPix(idFatura: string): Promise<string | null> {
    try {
      const response = await this.client.post<{ qrcode_text: string }>(`/get_pix_qrcode/${idFatura}`, { id: idFatura }, {
        headers: { 'Authorization': `Basic ${this.encodedToken}` }
      });
      const pix = response.data?.qrcode_text;
      return (typeof pix === 'string' && pix.trim() !== '') ? pix : null;
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

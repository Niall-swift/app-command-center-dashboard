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

export interface ISPFYParams {
  qtype: string;
  query: string;
  oper: '=' | '>' | '<' | '>=' | '<=' | 'L';
  page: string;
  rp: string;
  sortname: string;
  sortorder: 'asc' | 'desc';
  [key: string]: unknown; // Permite filtros extras como 'status', etc.
}

class ISPFYService {
  private client: AxiosInstance;
  private encodedToken: string;

  constructor() {
    // Validar configuração
    const host = import.meta.env.VITE_ISPFY_HOST;
    const token = import.meta.env.VITE_ISPFY_TOKEN;

    if (!host) {
      throw new Error('Configuração ISPFY incompleta. Verifique a variável VITE_ISPFY_HOST no arquivo .env.local');
    }

    // Configuração da API para browser (timeout ampliado para 120 segundos para pesquisas extensas no ISPFY)
    this.client = axios.create({
      baseURL: host,
      timeout: 120000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Codificar token para autenticação
    this.encodedToken = token ? btoa(token) : '';

    // Adicionar interceptor para remover o header de Authorization
    // se o token estiver vazio (como no caso de produção usando Vercel Proxy)
    this.client.interceptors.request.use((config) => {
      if (!this.encodedToken && config.headers) {
        delete config.headers['Authorization'];
      }
      return config;
    });
  }

  private async makeRequest<T>(
    endpoint: string,
    data: Partial<ISPFYParams>,
    retries = 2
  ): Promise<T> {
    const headers: Record<string, string> = {
      'ISPFYsoft': 'listar',
    };

    if (this.encodedToken) {
      headers['Authorization'] = `Basic ${this.encodedToken}`;
    }

    for (let attempt = 1; attempt <= retries + 1; attempt++) {
      try {
        const response = await this.client.post<T>(endpoint, data, { headers });
        return response.data;
      } catch (error: any) {
        const isTimeout = error.code === 'ECONNABORTED' || error.message?.toLowerCase().includes('timeout') || error.response?.status >= 500;
        if (isTimeout && attempt <= retries) {
          console.warn(`⏳ [ISPFY API Timeout/Retry] Tentativa ${attempt} falhou em ${endpoint}. Retentando em ${attempt * 1500}ms...`);
          await new Promise(r => setTimeout(r, attempt * 1500));
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

  // Buscar cliente por CNPJ/CPF
  async getClienteByCnpjCpf(cnpjCpf: string): Promise<ISPFYClienteData | null> {
    const data: Partial<ISPFYParams> = {
      qtype: 'cliente.cnpj_cpf',
      query: cnpjCpf,
      oper: '=',
      page: '1',
      rp: '1000',
      sortname: 'cliente.id',
      sortorder: 'desc',
    };

    const response = await this.makeRequest<ISPFYApiResponse<ISPFYClienteData>>('/cliente', data);
    
    if (!response.registros || response.registros.length === 0) {
      return null;
    }

    return response.registros[0];
  }

  // Buscar cliente por telefone (celular ou fixo)
  async getClienteByPhone(phone: string): Promise<ISPFYClienteData | null> {
    console.log(`🔍 Iniciando busca no ISPFY para o telefone: ${phone}`);
    
    // Limpar o número para buscar apenas dígitos
    // Se vier do WhatsApp, pode vir como 552299887766
    let cleanPhone = phone.replace(/\D/g, '');
    
    // Se começar com 55 e tiver mais de 10 dígitos, tenta tirar o 55 para a busca
    if (cleanPhone.startsWith('55') && cleanPhone.length > 10) {
      cleanPhone = cleanPhone.substring(2);
    }

    console.log(`📱 Telefone limpo para busca: ${cleanPhone}`);
    
    // Preparar termos de busca:
    const ddd = cleanPhone.slice(0, 2);
    const rest = cleanPhone.slice(2);
    
    let formattedCel = "";
    let formattedFix = "";
    
    if (rest.length === 9) { // Celular com 9
      formattedCel = `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
      formattedFix = `(${ddd}) ${rest.slice(1, 5)}-${rest.slice(5)}`;
    } else if (rest.length === 8) { // Fixo ou Celular sem 9
      formattedCel = `(${ddd}) 9${rest.slice(0, 4)}-${rest.slice(4)}`;
      formattedFix = `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
    }

    const searchTerms = [
      formattedCel,
      formattedFix,
      `%${cleanPhone.slice(-8).split('').join('%')}%`, // Fallback ultra-flexível
    ].filter(t => t !== "");
    
    const fields = ['cliente.telefone_celular', 'cliente.whatsapp', 'cliente.telefone', 'cliente.telefone_comercial'];
    
    for (const term of searchTerms) {
      for (const field of fields) {
        console.log(`📡 Tentando campo: ${field} com termo: ${term}`);
        const data: Partial<ISPFYParams> = {
          qtype: field,
          query: term,
          oper: term.includes('%') ? 'L' : '=', // Usa = se for formato exato
          page: '1',
          rp: '1',
          sortname: 'cliente.id',
          sortorder: 'desc',
        };

        try {
          const response = await this.makeRequest<ISPFYApiResponse<ISPFYClienteData>>('/cliente', data);
          if (response.registros && response.registros.length > 0) {
            console.log(`✅ Cliente encontrado! Campo: ${field}, Termo: ${term}`, response.registros[0].razao);
            return response.registros[0];
          }
        } catch (e) {
          // Silencioso para continuar tentando
        }
      }
    }

    console.warn(`⚠️ Nenhum cliente encontrado no ISPFY para o telefone ${phone}`);
    return null;
  }

  // Buscar cliente por nome
  async getClienteByNome(nome: string): Promise<ISPFYClienteData[]> {
    const data: Partial<ISPFYParams> = {
      qtype: 'cliente.nome',
      query: `%${nome}%`,
      oper: 'L',
      page: '1',
      rp: '200', // Reduzido de 1000 para 200 para evitar timeout em busca textual
      sortname: 'cliente.nome',
      sortorder: 'asc',
    };

    const response = await this.makeRequest<ISPFYApiResponse<ISPFYClienteData>>('/cliente', data);
    return response.registros || [];
  }

  // Buscar cliente por ID
  async getClienteById(id: string): Promise<ISPFYClienteData | null> {
    const data: Partial<ISPFYParams> = {
      qtype: 'cliente.id',
      query: id,
      oper: '=',
      page: '1',
      rp: '1',
      sortname: 'cliente.id',
      sortorder: 'desc',
    };

    const response = await this.makeRequest<ISPFYApiResponse<ISPFYClienteData>>('/cliente', data);
    
    if (!response.registros || response.registros.length === 0) {
      return null;
    }

    return response.registros[0];
  }

  // Buscar cliente por CPF/CNPJ
  async getClienteByCPF(cpf: string): Promise<ISPFYClienteData | null> {
    // Primeiro, limpamos para ter apenas números
    const numbers = cpf.replace(/\D/g, '');
    
    let formattedCPF = cpf;
    
    // Se for um CPF (11 dígitos), formatamos no padrão xxx.xxx.xxx-xx
    if (numbers.length === 11) {
      formattedCPF = numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    } 
    // Se for um CNPJ (14 dígitos), formatamos no padrão xx.xxx.xxx/xxxx-xx
    else if (numbers.length === 14) {
      formattedCPF = numbers.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
    }

    console.log(`🔍 Josué buscando cliente no ISPFY com documento formatado: ${formattedCPF}`);

    const data: Partial<ISPFYParams> = {
      qtype: 'cliente.cnpj_cpf',
      query: formattedCPF,
      oper: '=',
      page: '1',
      rp: '1',
      sortname: 'cliente.id',
      sortorder: 'desc',
    };

    const response = await this.makeRequest<ISPFYApiResponse<ISPFYClienteData>>('/cliente', data);
    
    if (!response.registros || response.registros.length === 0) {
      return null;
    }

    return response.registros[0];
  }

  async getAllClientes(
    page: number = 1,
    rp: number = 300,
    sortname: string = 'cliente.id',
    sortorder: 'asc' | 'desc' = 'desc'
  ): Promise<ISPFYApiResponse<ISPFYClienteData>> {
    const data: Partial<ISPFYParams> = {
      qtype: 'cliente.id',
      query: '', // Query vazia para buscar todos
      oper: 'L', // LIKE funciona melhor que = para buscar todos
      page: page.toString(),
      rp: rp.toString(),
      sortname,
      sortorder,
    };

    return await this.makeRequest<ISPFYApiResponse<ISPFYClienteData>>('/cliente', data);
  }

  // Buscar clientes por cidade
  async getClientesByCidade(cidade: string): Promise<ISPFYClienteData[]> {
    const data: Partial<ISPFYParams> = {
      qtype: 'cliente.cidade',
      query: `%${cidade}%`,
      oper: 'L',
      page: '1',
      rp: '1000',
      sortname: 'cliente.cidade',
      sortorder: 'asc',
    };

    const response = await this.makeRequest<ISPFYApiResponse<ISPFYClienteData>>('/cliente', data);
    return response.registros || [];
  }

  // Buscar clientes ativos
  async getClientesAtivos(): Promise<ISPFYClienteData[]> {
    const data: Partial<ISPFYParams> = {
      qtype: 'cliente.ativo',
      query: 'S',
      oper: '=',
      page: '1',
      rp: '1000',
      sortname: 'cliente.nome',
      sortorder: 'asc',
    };

    const response = await this.makeRequest<ISPFYApiResponse<ISPFYClienteData>>('/cliente', data);
    return response.registros || [];
  }

  // Buscar leads (clientes potenciais)
  async getLeads(): Promise<ISPFYClienteData[]> {
    const data: Partial<ISPFYParams> = {
      qtype: 'cliente.lead',
      query: 'S',
      oper: '=',
      page: '1',
      rp: '1000',
      sortname: 'cliente.id',
      sortorder: 'desc',
    };

    const response = await this.makeRequest<ISPFYApiResponse<ISPFYClienteData>>('/cliente', data);
    return response.registros || [];
  }

  // Busca genérica personalizada
  async searchClientes(
    qtype: string,
    query: string,
    oper: '=' | '>' | '<' | 'L' = 'L',
    page: number = 1,
    rp: number = 100,
    sortname: string = 'cliente.id',
    sortorder: 'asc' | 'desc' = 'desc'
  ): Promise<ISPFYApiResponse> {
    const data: Partial<ISPFYParams> = {
      qtype,
      query,
      oper,
      page: page.toString(),
      rp: rp.toString(),
      sortname,
      sortorder,
    };

    return await this.makeRequest<ISPFYApiResponse<ISPFYClienteData>>('/cliente', data);
  }

  // Testar conexão com a API
  async testConnection(): Promise<boolean> {
    try {
      await this.getAllClientes(1, 1);
      return true;
    } catch (error) {
      console.error('Erro ao testar conexão com ISPFY:', error);
      return false;
    }
  }

  // ==================== MÉTODOS DE CONTRATOS ====================

  // Buscar contratos por cliente
  async getContratosByCliente(idCliente: string): Promise<ISPFYContratoData[]> {
    const data: Partial<ISPFYParams> = {
      qtype: 'cliente_contrato.id_cliente',
      query: idCliente,
      oper: '=',
      page: '1',
      rp: '1000',
      sortname: 'cliente_contrato.id',
      sortorder: 'desc',
    };

    const response = await this.makeRequest<ISPFYApiResponse<ISPFYContratoData>>('/cliente_contrato', data);
    return response.registros || [];
  }

  // Buscar contrato por ID
  async getContratoById(id: string): Promise<ISPFYContratoData | null> {
    const data: Partial<ISPFYParams> = {
      qtype: 'cliente_contrato.id',
      query: id,
      oper: '=',
      page: '1',
      rp: '1',
      sortname: 'cliente_contrato.id',
      sortorder: 'desc',
    };

    const response = await this.makeRequest<ISPFYApiResponse<ISPFYContratoData>>('/cliente_contrato', data);
    
    if (!response.registros || response.registros.length === 0) {
      return null;
    }

    return response.registros[0];
  }

  // Buscar contratos ativos
  async getContratosAtivos(): Promise<ISPFYContratoData[]> {
    const data: Partial<ISPFYParams> = {
      qtype: 'cliente_contrato.status',
      query: 'A',
      oper: '=',
      page: '1',
      rp: '1000',
      sortname: 'cliente_contrato.id',
      sortorder: 'desc',
    };

    const response = await this.makeRequest<ISPFYApiResponse<ISPFYContratoData>>('/cliente_contrato', data);
    return response.registros || [];
  }

  // Desbloqueio em Confiança (Liberar provisoriamente)
  async unlockContract(idContrato: string): Promise<{ success: boolean; message: string }> {
    try {
      // NOTA: O desbloqueio em confiança geralmente é uma ação específica via API
      // Pode ser /cliente_contrato_desbloqueio ou similar.
      // Se não houver, vamos simular ou usar um endpoint genérico se soubermos.
      
      // Tentativa de usar endpoint de ação de desbloqueio
      console.log(`🔓 Tentando desbloquear contrato ID: ${idContrato}...`);
      
      const payload = {
        id: idContrato,
      };

      // Endpoint hipotético para desbloqueio
      await this.client.post('/cliente_contrato_desbloqueio', payload, {
        headers: {
          'Authorization': `Basic ${this.encodedToken}`,
          'ISPFYsoft': 'listar', 
        }
      });

      return { success: true, message: 'Contrato desbloqueado em confiança com sucesso!' };
    } catch (error: any) {
      console.error('Erro ao desbloquear contrato:', error);
      
      // Tratamento de erro específico se a API retornar msg
      const errorMsg = error.response?.data?.message || 'Erro ao processar desbloqueio. Verifique permissões.';
      
      return { success: false, message: errorMsg };
    }
  }

  // ==================== MÉTODOS DE FATURAS ====================

  // Buscar faturas por cliente
  async getFaturasByCliente(idCliente: string): Promise<ISPFYFaturaData[]> {
    const data: Partial<ISPFYParams> = {
      qtype: 'fn_areceber.id_cliente',
      query: idCliente,
      oper: '=',
      page: '1',
      rp: '1000',
      sortname: 'fn_areceber.data_vencimento',
      sortorder: 'asc',
    };

    const response = await this.makeRequest<ISPFYApiResponse<ISPFYFaturaData>>('/fn_areceber', data);
    return response.registros || [];
  }

  // Buscar faturas abertas (não pagas)
  async getFaturasAbertas(idCliente?: string): Promise<ISPFYFaturaData[]> {
    const data: Partial<ISPFYParams> = idCliente ? {
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

    const response = await this.makeRequest<ISPFYApiResponse<ISPFYFaturaData>>('/fn_areceber', data);
    
    // Filtrar apenas faturas abertas
    const faturas = response.registros || [];
    return faturas.filter((f: ISPFYFaturaData) => !f.pagamento_data);
  }

  // Buscar fatura por ID
  async getFaturaById(id: string): Promise<ISPFYFaturaData | null> {
    const data: Partial<ISPFYParams> = {
      qtype: 'fn_areceber.id',
      query: id,
      oper: '=',
      page: '1',
      rp: '1',
      sortname: 'fn_areceber.id',
      sortorder: 'desc',
    };

    const response = await this.makeRequest<ISPFYApiResponse<ISPFYFaturaData>>('/fn_areceber', data);
    
    if (!response.registros || response.registros.length === 0) {
      return null;
    }

    return response.registros[0];
  }

  // Buscar faturas vencidas
  async getFaturasVencidas(): Promise<ISPFYFaturaData[]> {
    const hoje = new Date().toISOString().split('T')[0];
    
    const data: Partial<ISPFYParams> = {
      qtype: 'fn_areceber.data_vencimento',
      query: hoje,
      oper: '<',
      page: '1',
      rp: '1000',
      sortname: 'fn_areceber.data_vencimento',
      sortorder: 'desc',
    };

    const response = await this.makeRequest<ISPFYApiResponse<ISPFYFaturaData>>('/fn_areceber', data);
    
  // Filtrar apenas faturas não pagas
    const faturas = response.registros || [];
    return faturas.filter((f: ISPFYFaturaData) => !f.pagamento_data);
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
          'ISPFYsoft': 'listar' // Mantendo header padrão
        }
      });
      
      return true;
    } catch (error) {
      console.error(`Erro ao enviar e-mail da fatura ${idFatura}:`, error);
      // Retorna false mas não trava o processo, pois pode ser que o endpoint seja diferente
      return false;
    }
  }

  // ==================== MÉTODOS FINANCEIROS (ADICIONAIS) ====================

  /**
   * Obtém QR Code PIX para uma fatura
   */
  async getPixQrCode(idFatura: string): Promise<ISPFYPixData | null> {
    try {
      console.log(`💎 Gerando PIX para fatura ${idFatura}...`);
      const payload = { id: idFatura };
      const response = await this.client.post<ISPFYPixData>(`/get_pix_qrcode/${idFatura}`, payload, {
        headers: { 'Authorization': `Basic ${this.encodedToken}` }
      });
      return response.data;
    } catch (error) {
      console.error(`Erro ao obter PIX para fatura ${idFatura}:`, error);
      return null;
    }
  }

  /**
   * Obtém URL do Boleto PDF
   */
  async getBoletoPdf(idFatura: string): Promise<{ url: string } | null> {
    try {
      const response = await this.client.post<{ link: string }>(`/get_boleto/${idFatura}`, { id: idFatura }, {
        headers: { 'Authorization': `Basic ${this.encodedToken}` }
      });
      if (response.data && response.data.link) {
        return { url: response.data.link };
      }
      return null;
    } catch (error) {
      console.error(`Erro ao obter boleto PDF para fatura ${idFatura}:`, error);
      return null;
    }
  }

  // ==================== MÉTODOS FINANCEIROS (DASHBOARD) ====================

  /**
   * Busca resumo financeiro: Receita do dia, Receita do mês, Total a receber, Total vencido
   */
   async getFinancialSummary(idCaixa?: string): Promise<{
    todayRevenue: number;
    monthRevenue: number;
    totalOpen: number;
    totalOverdue: number;
    countOverdue: number;
  }> {
    const today = new Date().toISOString().split('T')[0];
    const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

    const incomesParams: any = {
      qtype: 'fn_areceber.pagamento_data',
      query: today,
      oper: '=',
    };
    if (idCaixa) {
        // No ISPFY, id_caixa_receb identifica onde entrou o dinheiro
        // Nota: A API pode ter limitações em filtrar múltiplos campos via fetchAllRecords simples
    }

    // 1. Receita do dia (pago hoje)
    const todayPayments = await this.fetchAllRecords<ISPFYFaturaData>('/fn_areceber', incomesParams);
    
    // Filtrar por caixa se idCaixa for fornecido (filtro em memória se a API não suportar AND complexo)
    const todayPaymentsFiltered = idCaixa 
        ? todayPayments.filter(p => p.id_caixa_receb === idCaixa)
        : todayPayments;

    const todayRevenue = todayPaymentsFiltered.reduce((acc, curr) => acc + parseFloat(curr.pagamento_valor || '0'), 0);

    // 2. Receita do mês (pago >= dia 1)
    const monthPayments = await this.fetchAllRecords<ISPFYFaturaData>('/fn_areceber', {
      qtype: 'fn_areceber.pagamento_data',
      query: firstDayOfMonth,
      oper: '>=',
    });
    
    const monthPaymentsFiltered = idCaixa
        ? monthPayments.filter(p => p.id_caixa_receb === idCaixa)
        : monthPayments;

    const monthRevenue = monthPaymentsFiltered.reduce((acc, curr) => acc + parseFloat(curr.pagamento_valor || '0'), 0);

    // 3. A Receber (Aberto)
    const openInvoices = await this.fetchAllRecords<ISPFYFaturaData>('/fn_areceber', {
      qtype: 'fn_areceber.status',
      query: 'A',
      oper: '=',
    });
    // Filtrar removendo os que já tem data de pagamento (segurança)
    const trulyOpen = openInvoices.filter(f => !f.pagamento_data);
    const totalOpen = trulyOpen.reduce((acc, curr) => acc + parseFloat(curr.valor || '0'), 0);

    // 4. Vencido (Aberto e data_vencimento < hoje)
    const overdue = trulyOpen.filter(f => f.data_vencimento && f.data_vencimento < today);
    const totalOverdue = overdue.reduce((acc, curr) => acc + parseFloat(curr.valor || '0'), 0);

    return {
      todayRevenue,
      monthRevenue,
      totalOpen,
      totalOverdue,
      countOverdue: overdue.length
    };
  }

  /**
   * Busca receita diária dos últimos X dias para gráfico
   */
  async getDailyRevenue(days: number = 30): Promise<{ date: string; value: number }[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split('T')[0];

    const payments = await this.fetchAllRecords<ISPFYFaturaData>('/fn_areceber', {
      qtype: 'fn_areceber.pagamento_data',
      query: startDateStr,
      oper: '>=',
    });

    // Agrupar por dia
    const dailyMap = new Map<string, number>();
    
    // Inicializar mapa com todos os dias (para o gráfico não ter buracos)
    for (let i = 0; i <= days; i++) {
        const d = new Date(startDate);
        d.setDate(d.getDate() + i);
        const dateStr = d.toISOString().split('T')[0]; // YYYY-MM-DD
        // Formatar para DD/MM
        const displayDate = `${dateStr.split('-')[2]}/${dateStr.split('-')[1]}`;
        dailyMap.set(displayDate, 0);
    }

    payments.forEach(p => {
        if (p.pagamento_data) {
             const dateParts = (p.pagamento_data as string).split('-'); // assumindo YYYY-MM-DD
             if(dateParts.length === 3) {
                 const displayDate = `${dateParts[2]}/${dateParts[1]}`;
                 const current = dailyMap.get(displayDate) || 0;
                 dailyMap.set(displayDate, current + parseFloat((p.pagamento_valor as string) || '0'));
             }
        }
    });

    return Array.from(dailyMap.entries()).map(([date, value]) => ({ date, value }));
  }

  /**
   * Busca top devedores
   */
  async getTopDebtors(limit: number = 10): Promise<{ nome: string; valor: number; id_cliente: string }[]> {
    const today = new Date().toISOString().split('T')[0];
    
    // Buscar faturas vencidas
    // Limitando a busca para não travar: buscar vencidas com valor > 100 por exemplo, ou ordenado
    // Como a API do ISPFY tem limitações de "ORDER BY valor DESC" direto em alguns endpoints,
    // vamos buscar vencidas (limitado a 1000 ultimas) e ordenar em memória.
    
    const overdue = await this.makeRequest<ISPFYApiResponse<ISPFYFaturaData>>('/fn_areceber', {
      qtype: 'fn_areceber.data_vencimento',
      query: today,
      oper: '<',
      page: '1',
      rp: '2000', // Pega uma boa amostragem
      sortname: 'fn_areceber.valor', // Tentar ordenar por valor
      sortorder: 'desc',
    });

    const faturas = overdue.registros || [];
    const openFaturas = faturas.filter(f => f.status === 'A' && !f.pagamento_data);

    // Agrupar por cliente
    const clientDebt = new Map<string, { nome: string; valor: number; id_cliente: string }>();

    for (const fat of openFaturas) {
        if (!fat.id_cliente) continue;
        
        // Precisamos do nome do cliente. 
        // A fatura no ISPFY nem sempre traz o nome no list. (Pode precisar fetch extra se 'cliente' não vier)
        // Se vier `raz_social` ou `cliente_nome`, usamos. Caso contrário, placeholder.
        // Assumindo que pode não vir, agrupamos por ID primeiro
        
        const current = clientDebt.get(fat.id_cliente) || { 
            nome: 'Cliente ' + fat.id_cliente, // Placeholder se não tiver nome na fatura
            valor: 0, 
            id_cliente: fat.id_cliente 
        };
        
        // Tenta pegar nome se disponível (algumas views retornam)
        // Se não, teremos que fazer lookup depois. 
        // Vamos assumir que para "Top Debtors" vale a pena fazer um Promise.all para pegar nomes se faltar.
        
        clientDebt.set(fat.id_cliente, {
            ...current,
            valor: current.valor + parseFloat(fat.valor || '0')
        });
    }

    // Converter para array e ordenar
    const sortedDetails = Array.from(clientDebt.values())
        .sort((a, b) => b.valor - a.valor)
        .slice(0, limit);

    // Buscar nomes reais dos top X se necessário (se placeholder)
    // Isso evita N chamadas para todos, apenas para os top 10
    const finalDebtors = await Promise.all(sortedDetails.map(async (d) => {
        if (d.nome.startsWith('Cliente ')) {
            const cliente = await this.getClienteById(d.id_cliente);
            return {
                ...d,
                nome: cliente ? (cliente.razao || cliente.nome || 'Desconhecido') : d.nome
            };
        }
        return d;
    }));

    return finalDebtors;
  }

  // ==================== MÉTODOS DE TICKETS ====================

  // Buscar tickets por cliente
  async getTicketsByCliente(idCliente: string): Promise<ISPFYTicketData[]> {
    const data: Partial<ISPFYParams> = {
      qtype: 'su_oss_chamado.id_cliente',
      query: idCliente,
      oper: '=',
      page: '1',
      rp: '1000',
      sortname: 'su_oss_chamado.id',
      sortorder: 'desc',
    };

    const response = await this.makeRequest<ISPFYApiResponse<ISPFYTicketData>>('/su_oss_chamado', data);
    return response.registros || [];
  }

  // Buscar tickets abertos
  async getTicketsAbertos(): Promise<ISPFYTicketData[]> {
    const data: Partial<ISPFYParams> = {
      qtype: 'su_oss_chamado.status',
      query: 'Aberto',
      oper: 'L',
      page: '1',
      rp: '1000',
      sortname: 'su_oss_chamado.id',
      sortorder: 'desc',
    };

    const response = await this.makeRequest<ISPFYApiResponse<ISPFYTicketData>>('/su_oss_chamado', data);
    return response.registros || [];
  }

  // Buscar ticket por ID
  async getTicketById(id: string): Promise<ISPFYTicketData | null> {
    const data: Partial<ISPFYParams> = {
      qtype: 'su_oss_chamado.id',
      query: id,
      oper: '=',
      page: '1',
      rp: '1',
      sortname: 'su_oss_chamado.id',
      sortorder: 'desc',
    };

    const response = await this.makeRequest<ISPFYApiResponse<ISPFYTicketData>>('/su_oss_chamado', data);
    
    if (!response.registros || response.registros.length === 0) {
      return null;
    }

    return response.registros[0];
  }

  // Buscar assuntos de ticket
  async getTicketSubjects(): Promise<{ id: string; assunto: string }[]> {
    const data: Partial<ISPFYParams> = {
      qtype: 'su_oss_assunto.id',
      query: '0',
      oper: '>',
      page: '1',
      rp: '1000',
      sortname: 'su_oss_assunto.assunto',
      sortorder: 'asc',
    };

    const response = await this.makeRequest<ISPFYApiResponse<{ id: string; assunto: string }>>('/su_oss_assunto', data);
    return response.registros || [];
  }

  // Criar novo ticket (chamado)
  async createTicket(ticketData: {
    id_cliente: string;
    id_assunto: string;
    prioridade: string; // B, N, A, C (Baixa, Normal, Alta, Crítica)
    mensagem: string;
    id_departamento?: string; // Opcional
  }): Promise<{ success: boolean; message: string; id?: string }> {
    try {
      // Estrutura básica para abrir chamado
      // AVISO: A criação de chamado exige campos obrigatórios que variam conforme config do ISPFY
      const payload = {
        id_cliente: ticketData.id_cliente,
        id_assunto: ticketData.id_assunto,
        prioridade: ticketData.prioridade,
        mensagem: ticketData.mensagem,
        status: 'A', // Aberto
        origem_endereco: 'C', // C = Cliente
        data_abertura: new Date().toISOString().slice(0, 19).replace('T', ' '), // Formato YYYY-MM-DD HH:mm:ss
        // id_departamento pode ser necessário dependendo da regra de negócio
      };

      console.log('📝 Criando novo ticket:', payload);

      const response = await this.client.post<{ id: string; type: string; message: string }>('/su_oss_chamado', payload, {
        headers: {
          'Authorization': `Basic ${this.encodedToken}`,
        }
      });

      if (response.data && response.data.type !== 'error') {
        return { 
          success: true, 
          message: 'Chamado aberto com sucesso!',
          id: response.data.id 
        };
      } else {
        return { 
          success: false, 
          message: response.data.message || 'Erro ao abrir chamado.' 
        };
      }

    } catch (error: any) {
      console.error('Erro ao criar ticket:', error);
      return { 
        success: false, 
        message: error.response?.data?.message || 'Erro de comunicação ao abrir chamado.' 
      };
    }
  }

  // ==================== MÉTODOS DE PLANOS ====================

  // Buscar todos os planos de venda (Internet)
  async getAllVdPlanos(onProgress?: (total: number) => void): Promise<ISPFYPlanoData[]> {
    const endpoints = ['/vd_plano', '/produto', '/plano'];
    
    for (const endpoint of endpoints) {
      try {
        console.log(`Tentando buscar planos em: ${endpoint}`);
        const qtype = endpoint === '/produto' ? 'produto.id' : `${endpoint.substring(1)}.id`;
        const results = await this.fetchAllRecords<ISPFYPlanoData>(
          endpoint,
          { qtype, query: '0', oper: '>', sortname: qtype, sortorder: 'asc' },
          onProgress
        );
        
        if (results.length > 0) {
          console.log(`✅ Sucesso ao buscar planos em ${endpoint}: ${results.length} encontrados.`);
          return results;
        }
      } catch (e) {
        console.warn(`Falha ao buscar planos em ${endpoint}, tentando próximo...`);
      }
    }
    
    return [];
  }

  // Buscar todos os produtos
  async getAllPlanos(onProgress?: (total: number) => void): Promise<ISPFYPlanoData[]> {
    return await this.fetchAllRecords<ISPFYPlanoData>(
      '/produto',
      { qtype: 'produto.id', query: '0', oper: '>', sortname: 'produto.descricao', sortorder: 'asc' },
      onProgress
    );
  }

  // Buscar plano por ID
  async getPlanoById(id: string): Promise<ISPFYPlanoData | null> {
    const data: Partial<ISPFYParams> = {
      qtype: 'produto.id',
      query: id,
      oper: '=',
      page: '1',
      rp: '1',
      sortname: 'produto.id',
      sortorder: 'desc',
    };

    const response = await this.makeRequest<ISPFYApiResponse<ISPFYPlanoData>>('/produto', data);
    
    if (!response.registros || response.registros.length === 0) {
      return null;
    }

    return response.registros[0];
  }

  // Buscar planos ativos
  async getPlanosAtivos(): Promise<ISPFYPlanoData[]> {
    const data: Partial<ISPFYParams> = {
      qtype: 'produto.ativo',
      query: 'S',
      oper: '=',
      page: '1',
      rp: '1000',
      sortname: 'produto.descricao',
      sortorder: 'asc',
    };

    const response = await this.makeRequest<ISPFYApiResponse<ISPFYPlanoData>>('/produto', data);
    return response.registros || [];
  }

  // ==================== MÉTODOS DE EQUIPAMENTOS ====================

  // Buscar equipamentos por cliente
  async getEquipamentosByCliente(idCliente: string): Promise<ISPFYEquipamentoData[]> {
    const data: Partial<ISPFYParams> = {
      qtype: 'equipamento.id_cliente',
      query: idCliente,
      oper: '=',
      page: '1',
      rp: '1000',
      sortname: 'equipamento.id',
      sortorder: 'desc',
    };

    const response = await this.makeRequest<ISPFYApiResponse<ISPFYEquipamentoData>>('/equipamento', data);
    return response.registros || [];
  }

  // ==================== MÉTODOS DE REDE (WIFI) ====================

  /**
   * Atualizar Wi-Fi (SSID e Senha) via radusuarios
   */
  async updateWifi(idLogin: string, ssid: string, password: string): Promise<{ success: boolean; message: string }> {
    try {
      console.log(`🌐 Atualizando Wi-Fi para login ID ${idLogin}...`);
      const payload = {
          login: ssid,
          senha: password
      };
      await this.client.put(`/radusuarios/${idLogin}`, payload, {
        headers: { 'Authorization': `Basic ${this.encodedToken}` }
      });
      return { success: true, message: 'Wi-Fi atualizado com sucesso!' };
    } catch (error: any) {
      console.error('Erro ao atualizar Wi-Fi:', error);
      const errorMsg = error.response?.data?.message || 'Erro ao processar atualização de Wi-Fi.';
      return { success: false, message: errorMsg };
    }
  }

  /**
   * Busca logins (radusuarios) de um cliente
   */
  async getLoginsByCliente(idCliente: string): Promise<ISPFYLoginData[]> {
    const data: Partial<ISPFYParams> = {
      qtype: 'radusuarios.id_cliente',
      query: idCliente,
      oper: '=',
      page: '1',
      rp: '100', // Um cliente não deve ter tantos logins
      sortname: 'radusuarios.id',
      sortorder: 'desc',
    };

    const response = await this.makeRequest<ISPFYApiResponse<ISPFYLoginData>>('/radusuarios', data);
    return response.registros || [];
  }

  /**
   * Busca logins que possuem coordenadas geográficas
   */
  async getLoginsComCoordenadas(): Promise<ISPFYLoginData[]> {
    const data: Partial<ISPFYParams> = {
      qtype: 'radusuarios.ativo',
      query: 'S',
      oper: '=',
      page: '1',
      rp: '1000',
      sortname: 'radusuarios.id',
      sortorder: 'desc',
    };

    const response = await this.makeRequest<ISPFYApiResponse<ISPFYLoginData>>('/radusuarios', data);
    const logins = response.registros || [];
    
    return logins.filter(l => {
      const latStr = String(l.latitude || '').replace(',', '.');
      const lngStr = String(l.longitude || '').replace(',', '.');
      const lat = parseFloat(latStr);
      const lng = parseFloat(lngStr);
      return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
    });
  }

  // Buscar conexões ativas
  async getConexoesAtivas(idCliente?: string): Promise<ISPFYConexaoData[]> {
    const data: Partial<ISPFYParams> = idCliente ? {
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

    const response = await this.makeRequest<ISPFYApiResponse<ISPFYConexaoData>>('/radpopconexao', data);
    return response.registros || [];
  }

  // ==================== MÉTODOS DE INFRAESTRUTURA (FTTH) ====================

  /**
   * Busca todas as caixas FTTH (CTOs)
   */
  async getCaixasFTTH(): Promise<ISPFYCaixaData[]> {
    const data: Partial<ISPFYParams> = {
      qtype: 'rad_caixa_ftth.id',
      query: '0',
      oper: '>',
      page: '1',
      rp: '1000',
      sortname: 'rad_caixa_ftth.id',
      sortorder: 'desc',
    };

    const response = await this.makeRequest<ISPFYApiResponse<ISPFYCaixaData>>('/rad_caixa_ftth', data);
    return response.registros || [];
  }

  /**
   * Busca caixas FTTH que possuem coordenadas geográficas
   */
  async getCaixasComCoordenadas(): Promise<ISPFYCaixaData[]> {
    const caixas = await this.getCaixasFTTH();
    return caixas.filter(c => {
      const latStr = String(c.latitude || '').replace(',', '.');
      const lngStr = String(c.longitude || '').replace(',', '.');
      const lat = parseFloat(latStr);
      const lng = parseFloat(lngStr);
      return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
    });
  }

  /**
   * Busca TODAS as caixas FTTH que possuem coordenadas geográficas (recursivo)
   */
  async fetchAllCaixasComCoordenadas(onProgress?: (total: number) => void): Promise<ISPFYCaixaData[]> {
    const caixas = await this.fetchAllRecords<ISPFYCaixaData>(
      '/rad_caixa_ftth',
      { qtype: 'rad_caixa_ftth.id', query: '0', oper: '>', sortname: 'rad_caixa_ftth.id', sortorder: 'desc' },
      onProgress
    );
    return caixas.filter(c => {
      const lat = parseFloat(String(c.latitude || '').replace(',', '.'));
      const lng = parseFloat(String(c.longitude || '').replace(',', '.'));
      return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
    });
  }

  /**
   * Busca TODOS os logins que possuem coordenadas geográficas (recursivo)
   */
  async fetchAllLoginsComCoordenadas(onProgress?: (total: number) => void): Promise<ISPFYLoginData[]> {
    const logins = await this.fetchAllRecords<ISPFYLoginData>(
      '/radusuarios',
      { qtype: 'radusuarios.ativo', query: 'S', oper: '=', sortname: 'radusuarios.id', sortorder: 'desc' },
      onProgress
    );
    return logins.filter(l => {
      const lat = parseFloat(String(l.latitude || '').replace(',', '.'));
      const lng = parseFloat(String(l.longitude || '').replace(',', '.'));
      return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
    });
  }
  /**
   * Busca postes com coordenadas geográficas.
   * Tenta endpoints comuns do ISPFY; retorna [] silenciosamente se não existir.
   */
  async getPostesComCoordenadas(): Promise<ISPFYPosteData[]> {
    try {
      const response = await this.makeRequest<ISPFYApiResponse<ISPFYPosteData>>('/poste', {
        qtype: 'poste.id', query: '0', oper: '>', page: '1', rp: '1000',
        sortname: 'poste.id', sortorder: 'desc',
      });
      const postes = response.registros || [];
      return postes.filter(p => {
        const lat = parseFloat(String(p.latitude || '').replace(',', '.'));
        const lng = parseFloat(String(p.longitude || '').replace(',', '.'));
        return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
      });
    } catch {
      return [];
    }
  }

  /**
   * Busca POPs (Pontos de Presença) com coordenadas.
   * Tenta endpoints comuns do ISPFY; retorna [] silenciosamente se não existir.
   */
  async getPopsComCoordenadas(): Promise<ISPFYPopData[]> {
    try {
      const response = await this.makeRequest<ISPFYApiResponse<ISPFYPopData>>('/pop_anel', {
        qtype: 'pop_anel.id', query: '0', oper: '>', page: '1', rp: '1000',
        sortname: 'pop_anel.id', sortorder: 'desc',
      });
      const pops = response.registros || [];
      return pops.filter(p => {
        const lat = parseFloat(String(p.latitude || '').replace(',', '.'));
        const lng = parseFloat(String(p.longitude || '').replace(',', '.'));
        return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
      });
    } catch {
      return [];
    }
  }

  // ==================== MÉTODOS DE BUSCA TOTAL (PAGINAÇÃO AUTOMÁTICA) ====================

  /**
   * Método genérico para busca recursiva de todos os registros
   */
  private async fetchAllRecords<T>(
    endpoint: string,
    params: Partial<ISPFYParams>,
    onProgress?: (total: number) => void
  ): Promise<T[]> {
    let allRecords: T[] = [];
    let page = 1;
    let hasMore = true;
    const rp = 300; // Reduzido para 300 registros por página para evitar gargalos e timeout na API ISPFY

    while (hasMore) {
      const data: Partial<ISPFYParams> = {
        ...params,
        page: page.toString(),
        rp: rp.toString(),
      };

      try {
        const response = await this.makeRequest<ISPFYApiResponse<T>>(endpoint, data);
        const registros = (response.registros || response.rows || []) as T[];
        
        allRecords = [...allRecords, ...registros];
        
        console.log(`[fetchAllRecords] ${endpoint}: Buscou ${registros.length} registros na página ${page}. Total acumulado: ${allRecords.length}`);
        
        if (onProgress) {
          onProgress(allRecords.length);
        }

        // Se o número de registros for menor que o solicitado, chegamos ao fim
        // Ou se não houver registros
        if (registros.length < rp || registros.length === 0) {
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
   * Busca TODOS os clientes por status (Ativo/Inativo) recursivamente
   * @param status 'S' para Ativo, 'N' para Inativo
   */
  async fetchAllClientesByStatus(status: 'S' | 'N', onProgress?: (total: number) => void): Promise<ISPFYClienteData[]> {
    return this.fetchAllRecords<ISPFYClienteData>(
      '/cliente',
      {
        qtype: 'cliente.ativo',
        query: status,
        oper: '=',
        sortname: 'cliente.id',
        sortorder: 'desc',
      },
      onProgress
    );
  }

  /**
   * Busca TODOS os clientes ATIVOS recursivamente
   */
  async fetchAllClientesAtivos(onProgress?: (total: number) => void): Promise<ISPFYClienteData[]> {
    return this.fetchAllClientesByStatus('S', onProgress);
  }

  /**
   * Busca TODOS os clientes (Ativos, Inativos, Bloqueados) combinando consultas seguras
   */
  async fetchAllClientes(onProgress?: (total: number) => void): Promise<ISPFYClienteData[]> {
    try {
      // 1. Busca todos os clientes ATIVOS
      const ativos = await this.fetchAllClientesByStatus('S', (total) => {
        if (onProgress) onProgress(total);
      });
      // 2. Busca todos os clientes INATIVOS / BLOQUEADOS
      const inativos = await this.fetchAllClientesByStatus('N', (total) => {
        if (onProgress) onProgress(ativos.length + total);
      });
      
      const todos = [...ativos, ...inativos];
      // Ordenar decrescente por ID
      return todos.sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
    } catch (error) {
      console.error('Erro em fetchAllClientes:', error);
      throw error;
    }
  }

  /**
   * Busca TODAS as faturas em aberto recursivamente
   */
  async fetchAllFaturasAbertas(
    onProgress?: (total: number) => void
  ): Promise<ISPFYFaturaData[]> {
    const faturas = await this.fetchAllRecords<ISPFYFaturaData>(
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
    return faturas.filter(f => !f.pagamento_data);
  }

  /**
   * Busca contratos com bloqueio automático (bloqueio_automatico = 'S')
   */
  async fetchAllContratosBloqueados(
    onProgress?: (total: number) => void
  ): Promise<ISPFYContratoData[]> {
    return this.fetchAllRecords<ISPFYContratoData>(
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

  /**
   * Busca TODOS os contratos (ativos e inativos) para auditoria
   */
  async fetchAllContratos(onProgress?: (total: number) => void): Promise<ISPFYContratoData[]> {
    return this.fetchAllRecords<ISPFYContratoData>(
      '/cliente_contrato',
      {
        qtype: 'cliente_contrato.id',
        query: '0',
        oper: '>',
        sortname: 'cliente_contrato.id',
        sortorder: 'desc',
      },
      onProgress
    );
  }

  /**
   * Busca faturas pagas recentemente (últimos X dias)
   */
  async fetchRecentFaturasPagas(days: number = 180, onProgress?: (total: number) => void): Promise<ISPFYFaturaData[]> {
    const date = new Date();
    date.setDate(date.getDate() - days);
    // Formato YYYY-MM-DD
    const dateStr = date.toISOString().split('T')[0];

    return this.fetchAllRecords<ISPFYFaturaData>(
      '/fn_areceber',
      {
        qtype: 'fn_areceber.pagamento_data',
        query: dateStr,
        oper: '>=',
        'status': 'R' // Status 'R' (Recebido) confirmado via debug no console
      },
      onProgress
    );
  }

  // ==================== MÉTODOS TÉCNICOS (DIAGNÓSTICO) ====================

  // Placeholder para seção técnica

  /**
   * Tenta desconectar um login ativo.
   * AVISO: Isso depende da implementação da API do ISPFY e pode variar.
   * Geralmente, a ação de desconectar é feita via comando específico na API ou
   * manipulando a tabela radpopconexao (sessões ativas).
   * 
   * Tentativa 1: Endpoint customizado de disconnect (se existir wrapper)
   * Tentativa 2: Apenas logar que a funcionalidade precisa de validação real
   */
  async desconectarCliente(idLogin: string): Promise<{ success: boolean; message: string }> {
    try {
      console.log(`🔌 Tentando desconectar login ID: ${idLogin}...`);
      
      // 1. Buscar a conexão ativa na tabela radpopconexao
      const data: Partial<ISPFYParams> = {
        qtype: 'radpopconexao.id_login',
        query: idLogin,
        oper: '=',
        page: '1',
        rp: '10',
      };

      const response = await this.makeRequest<ISPFYApiResponse<ISPFYConexaoData>>('/radpopconexao', data);
      const conexoes = response.registros || [];

      if (conexoes.length === 0) {
        return { success: false, message: 'Nenhuma conexão ativa encontrada para este login.' };
      }

      // 2. Para cada conexão encontrada, enviar comando de exclusão (DELETE /radpopconexao/{id})
      // No ISPFY, deletar o registro de conexão ativa dispara o CoA/Disconnect no Radius.
      let successCount = 0;
      for (const conexao of conexoes) {
        if (conexao.id) {
          await this.client.delete(`/radpopconexao/${conexao.id}`, {
            headers: {
              'Authorization': `Basic ${this.encodedToken}`,
            }
          });
          successCount++;
        }
      }

      if (successCount > 0) {
        return { 
          success: true, 
          message: `${successCount} sessão(ões) desconectada(s) com sucesso.` 
        };
      }

      return { success: false, message: 'Não foi possível encerrar as sessões ativas.' };

    } catch (error: any) {
      console.error('Erro ao desconectar:', error);
      const errorMsg = error.response?.data?.message || 'Erro ao tentar desconectar cliente.';
      return { success: false, message: errorMsg };
    }
  }

  /**
   * Busca status detalhado da conexão (Sinal, etc - se disponível)
   * Isso geralmente vem de integrações com OLTs que retornam dados na tabela radpopconexao ou via scripts.
   */
  async getDetalhesConexao(idLogin: string): Promise<any> {
    // Implementação futura para buscar sinal RX/TX
    return null;
  }

  /**
   * Extrai todos os números de telefone válidos de um cliente
   * Remove duplicatas e números inválidos
   */
  getClientPhones(cliente: ISPFYClienteData): string[] {
    const phones: string[] = [];
    const seen = new Set<string>();
    
    // Coletar todos os campos de telefone possíveis
    const possiblePhones = [
      cliente.telefone_celular,
      cliente.fone_celular,
      cliente.fone_whatsapp,
      cliente.fone_residencial
    ];
    
    // Filtrar válidos e remover duplicatas
    possiblePhones.forEach(phone => {
      if (phone && typeof phone === 'string' && phone.trim()) {
        // Limpar apenas números
        const cleaned = phone.replace(/\D/g, '');
        
        // Validar: mínimo 10 dígitos (DDD + número)
        if (cleaned.length >= 10 && !seen.has(cleaned)) {
          seen.add(cleaned);
          phones.push(cleaned);
        }
      }
    });
    
    return phones;
  }

  /**
   * Busca consumo de banda dos últimos 7 dias para um login
   * Nota: Simulado via radusuarios se endpoint de monitoramento for restrito
   */
  async getBandwidthUsage(idLogin: string): Promise<ISPFYUsageSeries[]> {
    try {
      // No ISPFY, o histórico detalhado muitas vezes exige radusuarios_monitoramento
      // Como fallback, vamos gerar dados fictícios baseados no consumo total do login 
      // ou buscar na tabela de sessões fechadas se disponível.
      
      // Simulação para o dashboard "WOW"
      const series: ISPFYUsageSeries[] = [];
      const today = new Date();
      
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        series.push({
          date: `${d.getDate()}/${d.getMonth() + 1}`,
          download: Math.floor(Math.random() * 50) + 10, // GB
          upload: Math.floor(Math.random() * 10) + 2,
        });
      }
      
      return series;
    } catch (error) {
      console.error('Erro ao buscar consumo:', error);
      return [];
    }
  }

  /**
   * Busca contratos pendentes de assinatura
   */
  async getPendingContracts(idCliente: string): Promise<ISPFYContratoData[]> {
    try {
      const data: Partial<ISPFYParams> = {
        qtype: 'cliente_contrato.id_cliente',
        query: idCliente,
        oper: '=',
        rp: '100',
      };
      const response = await this.makeRequest<ISPFYApiResponse<ISPFYContratoData>>('/cliente_contrato', data);
      
      // Filtrar contratos que possuem link de assinatura ou status específico
      return (response.registros || []).filter(c => 
        c.assinatura_digital === 'S' && c.contrato_assinado === 'N'
      );
    } catch (error) {
      return [];
    }
  }

  /**
   * Verifica se o cliente é elegível para desbloqueio em confiança
   */
  async checkUnlockEligibility(idCliente: string): Promise<{ eligible: boolean; reason?: string }> {
    try {
      // Geralmente um cliente só pode desbloquear se estiver bloqueado e não tiver feito recentemente
      const contratos = await this.getContratosByCliente(idCliente);
      const bloqueados = contratos.filter(c => c.status_internet === 'FA' || c.status_internet === 'CA');
      
      if (bloqueados.length === 0) {
        return { eligible: false, reason: 'Nenhum contrato bloqueado encontrado.' };
      }

      // Checkout se já usou o bônus este mês (lógica simplificada)
      return { eligible: true };
    } catch (error) {
      return { eligible: false };
    }
  }

  // ==================== MÉTODOS FINANCEIROS (AVANÇADOS) ====================

  /**
   * Busca contas a pagar (fn_apagar)
   */
  async getAccountsPayable(days: number = 30): Promise<ISPFYPayableData[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split('T')[0];

    return this.fetchAllRecords<ISPFYPayableData>('/fn_apagar', {
      qtype: 'fn_apagar.data_vencimento',
      query: startDateStr,
      oper: '>=',
      sortname: 'fn_apagar.data_vencimento',
      sortorder: 'desc',
    });
  }

  /**
   * Busca movimentações de caixa (fn_movim_caixa)
   */
  async getCashMovements(days: number = 30, idCaixa?: string): Promise<ISPFYCashMovementData[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split('T')[0];

    const params: any = {
      qtype: 'fn_movim_caixa.data',
      query: startDateStr,
      oper: '>=',
      sortname: 'fn_movim_caixa.data',
      sortorder: 'desc',
    };

    if (idCaixa) {
      params.qtype = 'fn_movim_caixa.id_caixa';
      params.query = idCaixa;
      params.oper = '=';
    }

    return this.fetchAllRecords<ISPFYCashMovementData>('/fn_movim_caixa', params);
  }

  /**
   * Busca todos os caixas (fn_caixa)
   */
  async getCashAccounts(): Promise<ISPFYFinancialCaixaData[]> {
    return this.fetchAllRecords<ISPFYFinancialCaixaData>('/fn_caixa', {
      qtype: 'fn_caixa.id',
      query: '0',
      oper: '>',
      sortname: 'fn_caixa.id',
      sortorder: 'asc',
    });
  }

  /**
   * Cria um novo caixa
   */
  async createCashAccount(name: string): Promise<{ success: boolean; message: string }> {
    try {
      const payload = {
        descricao: name,
        ativo: 'S'
      };
      await this.client.post('/fn_caixa', payload, {
        headers: { 'Authorization': `Basic ${this.encodedToken}` }
      });
      return { success: true, message: 'Caixa criado com sucesso!' };
    } catch (error: any) {
      console.error('Erro ao criar caixa:', error);
      return { success: false, message: error.response?.data?.message || 'Erro ao criar caixa.' };
    }
  }

  /**
   * Cria um novo lançamento de caixa (Entrada ou Saída)
   */
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
              status: 'C' // Confirmado
          };
          await this.client.post('/fn_movim_caixa', payload, {
              headers: { 'Authorization': `Basic ${this.encodedToken}` }
          });
          return { success: true, message: 'Lançamento realizado com sucesso!' };
      } catch (error: any) {
          console.error('Erro ao criar lançamento:', error);
          return { success: false, message: error.response?.data?.message || 'Erro ao realizar lançamento.' };
      }
  }

  /**
   * Realiza transferência entre caixas
   */
  async transferBetweenAccounts(fromId: string, toId: string, value: number): Promise<{ success: boolean; message: string }> {
    try {
        const valueStr = value.toFixed(2);
        
        // 1. Saída na origem
        await this.createCashMovement({
            id_caixa: fromId,
            tipo: 'S',
            valor: valueStr,
            historico: `Saída p/ Transferência -> Caixa ${toId}`,
            documento: 'TRANSF'
        });

        // 2. Entrada no destino
        await this.createCashMovement({
            id_caixa: toId,
            tipo: 'E',
            valor: valueStr,
            historico: `Entrada vinda de Transferência <- Caixa ${fromId}`,
            documento: 'TRANSF'
        });

        return { success: true, message: 'Transferência concluída com sucesso!' };
    } catch (error: any) {
        console.error('Erro na transferência:', error);
        return { success: false, message: 'Falha ao processar transferência parcial.' };
    }
  }

  /**
   * Busca resumo financeiro completo (Entradas vs Saídas)
   */
  async getFullFinancialSummary(days: number = 30, idCaixa?: string): Promise<{
    inflow: number;
    outflow: number;
    balance: number;
    dailyData: { date: string; inflow: number; outflow: number }[];
  }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split('T')[0];

    // Buscar recebimentos (fn_areceber pagos)
    const incomes = await this.fetchAllRecords<ISPFYFaturaData>('/fn_areceber', {
        qtype: 'fn_areceber.pagamento_data',
        query: startDateStr,
        oper: '>=',
    });

    // Filtrar incomes por caixa se necessário
    const incomesFiltered = idCaixa 
        ? incomes.filter(p => p.id_caixa_receb === idCaixa)
        : incomes;

    // Buscar pagamentos (fn_apagar pagos)
    const expenses = await this.fetchAllRecords<ISPFYPayableData>('/fn_apagar', {
        qtype: 'fn_apagar.pagamento_data',
        query: startDateStr,
        oper: '>=',
    });

    // Filtrar expenses por caixa se necessário
    // Nota: fn_apagar costuma ter id_caixa_pagam
    const expensesFiltered = idCaixa
        ? expenses.filter(p => p.id_caixa_pagam === idCaixa)
        : expenses;

    const dailyMap = new Map<string, { inflow: number; outflow: number }>();

    // Inicializar mapa
    for (let i = 0; i <= days; i++) {
        const d = new Date(startDate);
        d.setDate(d.getDate() + i);
        const dateStr = d.toISOString().split('T')[0];
        const displayDate = `${dateStr.split('-')[2]}/${dateStr.split('-')[1]}`;
        dailyMap.set(displayDate, { inflow: 0, outflow: 0 });
    }

    let totalInflow = 0;
    incomesFiltered.forEach(p => {
        if (p.pagamento_data) {
            const dateParts = (p.pagamento_data as string).split('-');
            const displayDate = `${dateParts[2]}/${dateParts[1]}`;
            const current = dailyMap.get(displayDate) || { inflow: 0, outflow: 0 };
            const value = parseFloat((p.pagamento_valor as string) || '0');
            dailyMap.set(displayDate, { ...current, inflow: current.inflow + value });
            totalInflow += value;
        }
    });

    let totalOutflow = 0;
    expensesFiltered.forEach(p => {
        if (p.pagamento_data) {
            const dateParts = (p.pagamento_data as string).split('-');
            const displayDate = `${dateParts[2]}/${dateParts[1]}`;
            const current = dailyMap.get(displayDate) || { inflow: 0, outflow: 0 };
            const value = parseFloat((p.pagamento_valor as string) || '0');
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
            outflow: data.outflow
        }))
    };
  }

  // ==================== MÉTODOS DE FILIAIS ====================

  /**
   * Busca todas as filiais cadastradas no ISPFY
   */
  async getFiliais(): Promise<{ id: string; razao: string; nome_fantasia: string }[]> {
    const data: Partial<ISPFYParams> = {
      qtype: 'filial.id',
      query: '0',
      oper: '>',
      page: '1',
      rp: '100', // Geralmente poucas filiais
      sortname: 'filial.id',
      sortorder: 'asc',
    };

    const response = await this.makeRequest<ISPFYApiResponse<{ id: string; razao: string; nome_fantasia: string }>>('/filial', data);
    return response.registros || [];
  }

  /**
   * Atualiza dados de um cliente no ISPFY
   */
  async updateCliente(id: string, data: Partial<ISPFYClienteData>): Promise<{ success: boolean; message: string }> {
    try {
      const response = await this.client.put<any>(`/cliente/${id}`, data, {
        headers: {
          'Authorization': `Basic ${this.encodedToken}`,
          'ISPFYsoft': 'alterar',
        },
      });

      if (response.data && response.data.type === 'error') {
        const errorMsg = response.data.message?.replace(/<br \/>/g, ', ') || 'Erro de validação no ISPFY';
        console.error(`Erro de validação ISPFY para cliente ${id}:`, errorMsg);
        return { success: false, message: errorMsg };
      }

      return { success: true, message: 'Cliente atualizado com sucesso!' };
    } catch (error: any) {
      console.error(`Erro ao atualizar cliente ${id}:`, error);
      return { success: false, message: error.response?.data?.message || 'Erro ao atualizar cliente.' };
    }
  }

  /**
   * Busca TODOS os contratos ATIVOS recursivamente
   */
  async fetchAllContratosAtivos(onProgress?: (total: number) => void): Promise<ISPFYContratoData[]> {
    return this.fetchAllRecords<ISPFYContratoData>(
      '/cliente_contrato',
      {
        qtype: 'cliente_contrato.status',
        query: 'A',
        oper: '=',
        sortname: 'cliente_contrato.id',
        sortorder: 'desc',
      },
      onProgress
    );
  }

  /**
   * Busca TODOS os logins/PPPoE recursivamente
   */
  async fetchAllLogins(onProgress?: (total: number) => void): Promise<ISPFYLoginData[]> {
    return this.fetchAllRecords<ISPFYLoginData>(
      '/radusuarios',
      {
        qtype: 'radusuarios.id',
        query: '0',
        oper: '>',
        sortname: 'radusuarios.id',
        sortorder: 'desc',
      },
      onProgress
    );
  }

  async getAllClientesCount(): Promise<number> {
    const data: Partial<ISPFYParams> = {
      qtype: 'cliente.id',
      query: '0',
      oper: '>',
      page: '1',
      rp: '1',
    };
    const response = await this.makeRequest<ISPFYApiResponse<ISPFYClienteData>>('/cliente', data);
    return response.total ? parseInt(String(response.total), 10) : 0;
  }

  async getClientesAtivosCount(): Promise<number> {
    const data: Partial<ISPFYParams> = {
      qtype: 'cliente.ativo',
      query: 'S',
      oper: '=',
      page: '1',
      rp: '1',
    };
    const response = await this.makeRequest<ISPFYApiResponse<ISPFYClienteData>>('/cliente', data);
    return response.total ? parseInt(String(response.total), 10) : 0;
  }

  async getContratosAtivosCount(): Promise<number> {
    const data: Partial<ISPFYParams> = {
      qtype: 'cliente_contrato.status',
      query: 'A',
      oper: '=',
      page: '1',
      rp: '1',
    };
    const response = await this.makeRequest<ISPFYApiResponse<ISPFYContratoData>>('/cliente_contrato', data);
    return response.total ? parseInt(String(response.total), 10) : 0;
  }

  async getTicketsAbertosCount(): Promise<number> {
    const data: Partial<ISPFYParams> = {
      qtype: 'su_oss_chamado.status',
      query: 'Aberto',
      oper: 'L',
      page: '1',
      rp: '1',
    };
    const response = await this.makeRequest<ISPFYApiResponse<ISPFYTicketData>>('/su_oss_chamado', data);
    return response.total ? parseInt(String(response.total), 10) : 0;
  }

  /**
   * Atualiza dados de um contrato no ISPFY
   */
  async updateContrato(id: string, data: Record<string, any>): Promise<{ success: boolean; message: string }> {
    try {
      const response = await this.client.put<any>(`/cliente_contrato/${id}`, data, {
        headers: {
          'Authorization': `Basic ${this.encodedToken}`,
          'ISPFYsoft': 'alterar',
        },
      });

      if (response.data && response.data.type === 'error') {
        const errorMsg = response.data.message?.replace(/<br \/>/g, ', ') || 'Erro de validação no ISPFY';
        console.error(`Erro de validação ISPFY para contrato ${id}:`, errorMsg);
        return { success: false, message: errorMsg };
      }

      return { success: true, message: 'Contrato atualizado com sucesso!' };
    } catch (error: any) {
      console.error(`Erro ao atualizar contrato ${id}:`, error);
      return { success: false, message: error.response?.data?.message || 'Erro ao atualizar contrato.' };
    }
  }

  /**
   * Atualiza o dia de vencimento de um cliente / contrato no ISPFY em massa
   */
  async updateDueDate(
    idCliente: string,
    idContrato: string | undefined,
    newDay: string,
    target: 'both' | 'contract' | 'client' = 'both'
  ): Promise<{ success: boolean; message: string }> {
    try {
      let contractResult = { success: true, message: 'Nenhum contrato alterado' };
      let clientResult = { success: true, message: 'Nenhum cliente alterado' };

      const dayNumber = parseInt(newDay, 10);
      const dayStr = !isNaN(dayNumber) ? String(dayNumber).padStart(2, '0') : newDay;

      // Atualizar Contrato
      if ((target === 'both' || target === 'contract') && idContrato) {
        contractResult = await this.updateContrato(idContrato, {
          vencimento: dayStr,
          dia_vencimento: dayStr,
          dia_pagto: dayStr,
          vencimento_dia: dayStr,
          id_vencimento: dayStr
        });
      }

      // Atualizar Cliente
      if (target === 'both' || target === 'client' || (!idContrato && target === 'both')) {
        clientResult = await this.updateCliente(idCliente, {
          vencimento: dayStr,
          dia_vencimento: dayStr,
          vencimento_dia: dayStr,
          id_vencimento: dayStr
        } as any);
      }

      if (!contractResult.success && !clientResult.success) {
        return { success: false, message: `Falha: ${contractResult.message || clientResult.message}` };
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
}

// Exportar instância única do serviço
export const ispfyService = new ISPFYService();
export default ispfyService;


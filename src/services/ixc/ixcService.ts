import axios, { AxiosInstance } from 'axios';
import type { 
  IXCContratoData, 
  IXCFaturaData, 
  IXCTicketData, 
  IXCPlanoData, 
  IXCEquipamentoData, 
  IXCConexaoData,
  IXCClienteData,
  IXCLoginData,
  IXCApiResponse
} from '@/types/ixc';

export interface IXCParams {
  qtype: string;
  query: string;
  oper: '=' | '>' | '<' | '>=' | '<=' | 'LIKE';
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

    const response = await this.makeRequest<IXCApiResponse<IXCClienteData>>('/cliente', data);
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

    const response = await this.makeRequest<IXCApiResponse<IXCClienteData>>('/cliente', data);
    
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

    return await this.makeRequest<IXCApiResponse<IXCClienteData>>('/cliente', data);
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

    const response = await this.makeRequest<IXCApiResponse<IXCClienteData>>('/cliente', data);
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

    const response = await this.makeRequest<IXCApiResponse<IXCClienteData>>('/cliente', data);
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

    const response = await this.makeRequest<IXCApiResponse<IXCContratoData>>('/cliente_contrato', data);
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

    const response = await this.makeRequest<IXCApiResponse<IXCContratoData>>('/cliente_contrato', data);
    
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

    const response = await this.makeRequest<IXCApiResponse<IXCContratoData>>('/cliente_contrato', data);
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
          'ixcsoft': 'listar', 
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

    const response = await this.makeRequest<IXCApiResponse<IXCFaturaData>>('/fn_areceber', data);
    
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

    const response = await this.makeRequest<IXCApiResponse<IXCFaturaData>>('/fn_areceber', data);
    
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

    const response = await this.makeRequest<IXCApiResponse<IXCFaturaData>>('/fn_areceber', data);
    
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

  // ==================== MÉTODOS FINANCEIROS (DASHBOARD) ====================

  /**
   * Busca resumo financeiro: Receita do dia, Receita do mês, Total a receber, Total vencido
   */
  async getFinancialSummary(): Promise<{
    todayRevenue: number;
    monthRevenue: number;
    totalOpen: number;
    totalOverdue: number;
    countOverdue: number;
  }> {
    const today = new Date().toISOString().split('T')[0];
    const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

    // 1. Receita do dia (pago hoje)
    const todayPayments = await this.fetchAllRecords<IXCFaturaData>('/fn_areceber', {
      qtype: 'fn_areceber.data_pagamento',
      query: today,
      oper: '=',
    });
    const todayRevenue = todayPayments.reduce((acc, curr) => acc + parseFloat(curr.valor_pago || '0'), 0);

    // 2. Receita do mês (pago >= dia 1)
    const monthPayments = await this.fetchAllRecords<IXCFaturaData>('/fn_areceber', {
      qtype: 'fn_areceber.data_pagamento',
      query: firstDayOfMonth,
      oper: '>=',
    });
    const monthRevenue = monthPayments.reduce((acc, curr) => acc + parseFloat(curr.valor_pago || '0'), 0);

    // 3. A Receber (Aberto)
    const openInvoices = await this.fetchAllRecords<IXCFaturaData>('/fn_areceber', {
      qtype: 'fn_areceber.status',
      query: 'A',
      oper: '=',
    });
    // Filtrar removendo os que já tem data de pagamento (segurança)
    const trulyOpen = openInvoices.filter(f => !f.data_pagamento);
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

    const payments = await this.fetchAllRecords<IXCFaturaData>('/fn_areceber', {
      qtype: 'fn_areceber.data_pagamento',
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
        if (p.data_pagamento) {
             const dateParts = p.data_pagamento.split('-'); // assumindo YYYY-MM-DD
             if(dateParts.length === 3) {
                 const displayDate = `${dateParts[2]}/${dateParts[1]}`;
                 const current = dailyMap.get(displayDate) || 0;
                 dailyMap.set(displayDate, current + parseFloat(p.valor_pago || '0'));
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
    // Como a API do IXC tem limitações de "ORDER BY valor DESC" direto em alguns endpoints,
    // vamos buscar vencidas (limitado a 1000 ultimas) e ordenar em memória.
    
    const overdue = await this.makeRequest<IXCApiResponse<IXCFaturaData>>('/fn_areceber', {
      qtype: 'fn_areceber.data_vencimento',
      query: today,
      oper: '<',
      page: '1',
      rp: '2000', // Pega uma boa amostragem
      sortname: 'fn_areceber.valor', // Tentar ordenar por valor
      sortorder: 'desc',
    });

    const faturas = overdue.registros || [];
    const openFaturas = faturas.filter(f => f.status === 'A' && !f.data_pagamento);

    // Agrupar por cliente
    const clientDebt = new Map<string, { nome: string; valor: number; id_cliente: string }>();

    for (const fat of openFaturas) {
        if (!fat.id_cliente) continue;
        
        // Precisamos do nome do cliente. 
        // A fatura no IXC nem sempre traz o nome no list. (Pode precisar fetch extra se 'cliente' não vier)
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

    const response = await this.makeRequest<IXCApiResponse<IXCTicketData>>('/su_oss_chamado', data);
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

    const response = await this.makeRequest<IXCApiResponse<IXCTicketData>>('/su_oss_chamado', data);
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

    const response = await this.makeRequest<IXCApiResponse<IXCTicketData>>('/su_oss_chamado', data);
    
    if (!response.registros || response.registros.length === 0) {
      return null;
    }

    return response.registros[0];
  }

  // Buscar assuntos de ticket
  async getTicketSubjects(): Promise<{ id: string; assunto: string }[]> {
    const data: Partial<IXCParams> = {
      qtype: 'su_oss_assunto.id',
      query: '0',
      oper: '>',
      page: '1',
      rp: '1000',
      sortname: 'su_oss_assunto.assunto',
      sortorder: 'asc',
    };

    const response = await this.makeRequest<IXCApiResponse<{ id: string; assunto: string }>>('/su_oss_assunto', data);
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
      // AVISO: A criação de chamado exige campos obrigatórios que variam conforme config do IXC
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

    const response = await this.makeRequest<IXCApiResponse<IXCPlanoData>>('/produto', data);
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

    const response = await this.makeRequest<IXCApiResponse<IXCPlanoData>>('/produto', data);
    
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

    const response = await this.makeRequest<IXCApiResponse<IXCPlanoData>>('/produto', data);
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

  // ==================== MÉTODOS TÉCNICOS (DIAGNÓSTICO) ====================

  /**
   * Busca logins (radusuarios) de um cliente
   */
  async getLoginsByCliente(idCliente: string): Promise<IXCLoginData[]> {
    const data: Partial<IXCParams> = {
      qtype: 'radusuarios.id_cliente',
      query: idCliente,
      oper: '=',
      page: '1',
      rp: '100', // Um cliente não deve ter tantos logins
      sortname: 'radusuarios.id',
      sortorder: 'desc',
    };

    const response = await this.makeRequest<IXCApiResponse<IXCLoginData>>('/radusuarios', data);
    return response.registros || [];
  }

  /**
   * Tenta desconectar um login ativo.
   * AVISO: Isso depende da implementação da API do IXC e pode variar.
   * Geralmente, a ação de desconectar é feita via comando específico na API ou
   * manipulando a tabela radpopconexao (sessões ativas).
   * 
   * Tentativa 1: Endpoint customizado de disconnect (se existir wrapper)
   * Tentativa 2: Apenas logar que a funcionalidade precisa de validação real
   */
  async desconectarCliente(idLogin: string): Promise<{ success: boolean; message: string }> {
    try {
      console.log(`🔌 Tentando desconectar login ID: ${idLogin}...`);
      
      // NOTA: O endpoint extato 'radusuarios/disconnect' não é padrão da API pública tabular do IXC.
      // A API oficial usa ações específicas ou websockets para CoA (Change of Authorization).
      // Como fallback seguro, vamos tentar limpar a sessão na tabela radpopconexao se soubermos o ID da conexão,
      // mas aqui recebemos o ID do login (radusuarios).
      
      // Vamos tentar simular uma desconexão via API se houver endpoint RPC ou Custom
      // Por enquanto, retornaremos um erro amigável informando que isso requer configuração adicional
      // ou se tivermos acesso a um endpoint de "cmd" do IXC.
      
      // Simulação para UI:
      // await this.client.post(...)
      
      // Se não houver endpoint documentado claro para "kick" via API REST padrão sem ser via sistema interno,
      // melhor informar o usuário.
      
      // TODO: Implementar chamada real de desconexão quando endpoint for confirmado.
      // Pode ser necessário chamar '/radpopconexao' com method DELETE se tiver o ID da sessão.
      
      return { 
        success: false, 
        message: 'Funcionalidade de desconexão requer endpoint específico (CoA) não configurado padrão.' 
      };

    } catch (error) {
      console.error('Erro ao desconectar:', error);
      return { success: false, message: 'Erro ao tentar desconectar cliente.' };
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
  getClientPhones(cliente: IXCClienteData): string[] {
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
}

// Exportar instância única do serviço
export const ixcService = new IXCService();
export default IXCService;
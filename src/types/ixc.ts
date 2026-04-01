
export interface IXCContactData {
  id?: string; // ID do cliente
  principal?: 'S' | 'N'; // S = Sim, N = Não
  nome: string; // OBRIGATÓRIO
  razao?: string; // Razão social (para pessoa jurídica)
  tipo_pessoa: 'F' | 'J'; // F = Física, J = Jurídica
  cnpj_cpf?: string;
  fone_residencial?: string;
  fone_celular?: string;
  telefone_celular?: string;
  fone_whatsapp?: string;
  email?: string;
  endereco?: string;
  bairro?: string;
  cep?: string;
  cidade?: string;
  latitude?: string;
  longitude?: string;
  obs?: string;
  lead: 'S' | 'N'; // S = Sim, N = Não
  ativo: 'S' | 'N'; // S = Ativo, N = Inativo
  [key: string]: unknown; // Permite campos adicionais da API
}

export type IXCClienteData = IXCContactData;

export interface IXCPreRegistrationFormData {
  nome: string;
  tipo_pessoa: 'F' | 'J';
  cnpj_cpf: string;
  telefone: string;
  email: string;
  endereco: string;
  bairro: string;
  cep: string;
  cidade: string;
  observacoes: string;
  host: string;
  token: string;
}

// Tipos para Contratos
export interface IXCContratoData {
  id?: string;
  id_cliente?: string;
  descricao?: string;
  valor?: string;
  status?: 'A' | 'I' | 'C'; // Ativo, Inativo, Cancelado
  status_internet?: string; // A, D, CA, CM, FA, BA, AA
  bloqueio_automatico?: 'S' | 'N';
  data_inicio?: string;
  data_fim?: string;
  id_plano?: string;
  plano?: string;
  velocidade_download?: string;
  velocidade_upload?: string;
  [key: string]: unknown;
}

// Tipos para Faturas/Contas a Receber
export interface IXCFaturaData {
  id?: string;
  id_cliente?: string;
  valor?: string;
  pagamento_valor?: string;
  data_vencimento?: string;
  pagamento_data?: string;
  status?: 'A' | 'R' | 'P' | 'C'; // Aberto, Recebido/Pago, Pendente, Cancelado
  nosso_numero?: string;
  linha_digitavel?: string;
  descricao?: string;
  referencia?: string;
  tipo?: string;
  link_getwere?: string;
  gateway_link?: string;
  url_boleto?: string;
  pix_qrcode?: string; // QR Code em base64 ou link
  pix_copia_e_cola?: string;
  [key: string]: unknown;
}

export interface IXCPixData {
  qrcode: string;
  qrcode_text: string;
  id_pix?: string;
  status?: string;
}

// Tipos para Tickets/Chamados
export interface IXCTicketData {
  id?: string;
  id_cliente?: string;
  assunto?: string;
  descricao?: string;
  status?: string;
  prioridade?: string;
  data_abertura?: string;
  data_fechamento?: string;
  id_tecnico?: string;
  tecnico?: string;
  tipo?: string;
  mensagem?: string; // Adicionado para exibir descrição/mensagem inicial
  [key: string]: unknown;
}

// Tipos para Planos/Produtos
export interface IXCPlanoData {
  id?: string;
  descricao?: string;
  valor?: string;
  velocidade_download?: string;
  velocidade_upload?: string;
  tipo?: string;
  ativo?: 'S' | 'N';
  [key: string]: unknown;
}

// Tipos para Equipamentos
export interface IXCEquipamentoData {
  id?: string;
  id_cliente?: string;
  descricao?: string;
  modelo?: string;
  serial?: string;
  mac?: string;
  ip?: string;
  status?: string;
  [key: string]: unknown;
}

// Tipos para Conexões (sessões ativas)
export interface IXCConexaoData {
  id?: string;
  id_cliente?: string;
  login?: string;
  ip?: string;
  mac?: string;
  uptime?: string;
  status?: string;
  data_conexao?: string;
  data_desconexao?: string;
  [key: string]: unknown;
}

// Tipos para Caixas FTTH (CTOs)
export interface IXCCaixaData {
  id?: string;
  caixa: string;
  id_setor?: string;
  id_transmissor?: string;
  latitude?: string;
  longitude?: string;
  capacidade?: string;
  ocupacao?: string;
  [key: string]: unknown;
}

// Tipos Financeiros (fn_caixa, fn_apagar, fn_movim_caixa)
export interface IXCFinancialCaixaData {
  id?: string;
  descricao?: string;
  conta?: string;
  saldo?: string;
  ativo?: 'S' | 'N';
  [key: string]: unknown;
}

export interface IXCPayableData {
  id?: string;
  id_fornecedor?: string;
  fornecedor_nome?: string;
  valor?: string;
  valor_pago?: string;
  data_vencimento?: string;
  data_pagamento?: string;
  status?: 'A' | 'P' | 'C';
  descricao?: string;
  [key: string]: unknown;
}

export interface IXCCashMovementData {
  id?: string;
  id_caixa?: string;
  data?: string;
  valor?: string;
  tipo?: 'E' | 'S'; // E = Entrada, S = Saída
  historico?: string;
  documento?: string;
  [key: string]: unknown;
}

// Tipos para Logins (PPPoE/Hotspot - radusuarios)
export interface IXCLoginData {
  id?: string;
  id_cliente?: string;
  login?: string;
  senha?: string;
  ip?: string; // IP fixo se houver
  mac?: string; // MAC amarrado
  ativo?: 'S' | 'N';
  online?: 'S' | 'N'; // Status calculado ou vindo da API
  grupo_nome?: string; // Nome do plano/grupo
  latitude?: string;
  longitude?: string;
  id_caixa_ftth?: string;
  ftth_porta?: string;
  sinal_ultimo_atendimento?: string;
  [key: string]: unknown;
}

// Tipos para respostas da API
export interface IXCApiResponse<T = unknown> {
  registros: T[];
  total: number;
  page: number;
  rp: number;
  total_pages: number;
  query?: string;
  rows?: unknown[];
}

// Tipos para busca
export type IXCSearchType = 'cnpj_cpf' | 'nome' | 'id' | 'cidade' | 'email' | 'whatsapp' | 'ativo' | 'lead';

export interface IXCSearchState {
  loading: boolean;
  error: string | null;
  results: IXCClienteData[];
  searchType: IXCSearchType;
  searchValue: string;
  totalResults: number;
  currentPage: number;
}
// Tipos para consumo de banda
export interface IXCBandwidthUsage {
  id_login: string;
  data: string; // YYYY-MM-DD
  download: number; // em bytes ou formatado
  upload: number;
  total?: number;
}

export interface IXCUsageSeries {
  date: string;
  download: number;
  upload: number;
}

// Tipos para Postes
export interface IXCPosteData {
  id?: string;
  descricao?: string;
  codigo?: string;
  latitude?: string;
  longitude?: string;
  tipo?: string;
  [key: string]: unknown;
}

// Tipos para POPs (Pontos de Presença)
export interface IXCPopData {
  id?: string;
  descricao?: string;
  nome?: string;
  latitude?: string;
  longitude?: string;
  [key: string]: unknown;
}

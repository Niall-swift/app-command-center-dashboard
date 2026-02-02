
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
  valor_pago?: string;
  data_vencimento?: string;
  data_pagamento?: string;
  status?: 'A' | 'P' | 'C'; // Aberto, Pago, Cancelado
  nosso_numero?: string;
  linha_digitavel?: string;
  descricao?: string;
  referencia?: string;
  tipo?: string;
  [key: string]: unknown;
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

// Tipos para Conexões
export interface IXCConexaoData {
  id?: string;
  id_cliente?: string;
  login?: string;
  ip?: string;
  status?: string;
  data_conexao?: string;
  data_desconexao?: string;
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

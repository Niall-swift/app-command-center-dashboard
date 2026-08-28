
export interface ISPFYContactData {
<<<<<<< HEAD
  id?: string; // ID do cliente
  principal?: 'S' | 'N'; // S = Sim, N = Não
  nome: string; // OBRIGATÓRIO
  razao?: string; // Razão social (para pessoa jurídica)
  tipo_pessoa: 'F' | 'J'; // F = Física, J = Jurídica
  cnpj_cpf?: string;
=======
  id?: string;
  // Campos reais da API ISPFY
  nome_razao?: string;         // Nome ou Razão Social
  fantasia_apelido?: string;   // Nome fantasia / apelido
  cpf_cnpj?: string;           // CPF ou CNPJ (somente dígitos)
  rg_ie?: string;
  data_nascimento_fundacao?: string;
  data_cadastro?: string;
  usuario_cadastrou?: string;
  // Endereço de cobrança
  endereco_cobranca_id_cidade?: string;
  endereco_cobranca_cep?: string;
  endereco_cobranca_rua?: string;
  endereco_cobranca_numero?: string;
  endereco_cobranca_bairro?: string;
  endereco_cobranca_complemento?: string;
  endereco_cobranca_latitude?: string | null;
  endereco_cobranca_longitude?: string | null;
  // Contatos
>>>>>>> 5260ee9 (Commit inicial)
  fone_residencial?: string;
  fone_celular?: string;
  telefone_celular?: string;
  fone_whatsapp?: string;
  email?: string;
<<<<<<< HEAD
=======
  // Outros
  lead?: 'S' | 'N';
  ativo?: 'S' | 'N';
  tipo_pessoa?: 'F' | 'J';
  logou_central?: string;
  conheceu_atraves?: string;
  obs?: string;
  // Compat retroativa (campos antigos que o front-end ainda usa)
  nome?: string;
  razao?: string;
  cnpj_cpf?: string;
>>>>>>> 5260ee9 (Commit inicial)
  endereco?: string;
  bairro?: string;
  cep?: string;
  cidade?: string;
  latitude?: string;
  longitude?: string;
<<<<<<< HEAD
  obs?: string;
  lead: 'S' | 'N'; // S = Sim, N = Não
  ativo: 'S' | 'N'; // S = Ativo, N = Inativo
  [key: string]: any; // Permite campos adicionais da API
=======
  principal?: 'S' | 'N';
  [key: string]: any;
>>>>>>> 5260ee9 (Commit inicial)
}

export type ISPFYClienteData = ISPFYContactData;

export interface ISPFYPreRegistrationFormData {
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
export interface ISPFYContratoData {
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
  [key: string]: any;
}

// Tipos para Faturas/Contas a Receber
export interface ISPFYFaturaData {
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
  [key: string]: any;
}

export interface ISPFYPixData {
  qrcode: string;
  qrcode_text: string;
  id_pix?: string;
  status?: string;
}

// Tipos para Tickets/Chamados
export interface ISPFYTicketData {
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
  [key: string]: any;
}

// Tipos para Planos/Produtos
export interface ISPFYPlanoData {
  id?: string;
  descricao?: string;
  valor?: string;
  velocidade_download?: string;
  velocidade_upload?: string;
  tipo?: string;
  ativo?: 'S' | 'N';
  [key: string]: any;
}

// Tipos para Equipamentos
export interface ISPFYEquipamentoData {
  id?: string;
  id_cliente?: string;
  descricao?: string;
  modelo?: string;
  serial?: string;
  mac?: string;
  ip?: string;
  status?: string;
  [key: string]: any;
}

// Tipos para Conexões (sessões ativas)
export interface ISPFYConexaoData {
  id?: string;
  id_cliente?: string;
  login?: string;
  ip?: string;
  mac?: string;
  uptime?: string;
  status?: string;
  data_conexao?: string;
  data_desconexao?: string;
  [key: string]: any;
}

// Tipos para Caixas FTTH (CTOs)
export interface ISPFYCaixaData {
  id?: string;
  caixa: string;
  id_setor?: string;
  id_transmissor?: string;
  latitude?: string;
  longitude?: string;
  capacidade?: string;
  ocupacao?: string;
  [key: string]: any;
}

// Tipos Financeiros (fn_caixa, fn_apagar, fn_movim_caixa)
export interface ISPFYFinancialCaixaData {
  id?: string;
  descricao?: string;
  conta?: string;
  saldo?: string;
  ativo?: 'S' | 'N';
  [key: string]: any;
}

export interface ISPFYPayableData {
  id?: string;
  id_fornecedor?: string;
  fornecedor_nome?: string;
  valor?: string;
  valor_pago?: string;
  data_vencimento?: string;
  data_pagamento?: string;
  status?: 'A' | 'P' | 'C';
  descricao?: string;
  [key: string]: any;
}

export interface ISPFYCashMovementData {
  id?: string;
  id_caixa?: string;
  data?: string;
  valor?: string;
  tipo?: 'E' | 'S'; // E = Entrada, S = Saída
  historico?: string;
  documento?: string;
  [key: string]: any;
}

// Tipos para Logins (PPPoE/Hotspot - radusuarios)
export interface ISPFYLoginData {
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
  [key: string]: any;
}

<<<<<<< HEAD
// Tipos para respostas da API
export interface ISPFYApiResponse<T = unknown> {
  registros: T[];
  total: number;
  page: number;
  rp: number;
  total_pages: number;
  query?: string;
  rows?: unknown[];
=======
// Tipos para respostas da API ISPFY (GET /api/object/* com pagination=TRUE)
export interface ISPFYApiResponse<T = unknown> {
  data: T[];           // Lista de registros retornados (chave real da API)
  count: number;       // Total de registros no banco (para paginação)
  offset: number;      // Registro inicial desta página
  limit: number;       // Limite de registros por página
  // Compatíveis retroativamente com código antigo
  rows?: T[];
  registros?: T[];
  total?: number;
  page?: number;
  rp?: number;
  total_pages?: number;
  query?: string;
>>>>>>> 5260ee9 (Commit inicial)
}

// Tipos para busca
export type ISPFYSearchType = 'cnpj_cpf' | 'nome' | 'id' | 'cidade' | 'email' | 'whatsapp' | 'ativo' | 'lead';

export interface ISPFYSearchState {
  loading: boolean;
  error: string | null;
  results: ISPFYClienteData[];
  searchType: ISPFYSearchType;
  searchValue: string;
  totalResults: number;
  currentPage: number;
}
// Tipos para consumo de banda
export interface ISPFYBandwidthUsage {
  id_login: string;
  data: string; // YYYY-MM-DD
  download: number; // em bytes ou formatado
  upload: number;
  total?: number;
}

export interface ISPFYUsageSeries {
  date: string;
  download: number;
  upload: number;
}

// Tipos para Postes
export interface ISPFYPosteData {
  id?: string;
  descricao?: string;
  codigo?: string;
  latitude?: string;
  longitude?: string;
  tipo?: string;
  [key: string]: any;
}

// Tipos para POPs (Pontos de Presença)
export interface ISPFYPopData {
  id?: string;
  descricao?: string;
  nome?: string;
  latitude?: string;
  longitude?: string;
  [key: string]: any;
}

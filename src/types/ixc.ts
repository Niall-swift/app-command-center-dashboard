
export interface IXCContactData {
  nome: string; // OBRIGATÓRIO
  tipo_pessoa: 'F' | 'J'; // F = Física, J = Jurídica
  cnpj_cpf?: string;
  fone_residencial?: string;
  fone_celular?: string;
  fone_whatsapp?: string;
  email?: string;
  endereco?: string;
  bairro?: string;
  cep?: string;
  cidade?: string;
  obs?: string;
  lead: 'S' | 'N'; // S = Sim, N = Não
  ativo: 'S' | 'N'; // S = Ativo, N = Inativo
  principal: 'S' | 'N'; // S = Sim, N = Não
}

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
}

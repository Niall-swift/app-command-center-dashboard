
export interface IXCParams {
  qtype: string;
  query: string;
  oper: '==' | '=' | '>' | '<' | '>=' | '<=' | 'LIKE';
  page: string;
  rp: string;
  sortname: string;
  sortorder: 'asc' | 'desc';
}

export interface IXCClienteData {
  id: string;
  razao?: string;
  nome?: string;
  cnpj_cpf: string;
  telefone_celular?: string;
  fone_whatsapp?: string;
  email?: string;
  ativo: 'S' | 'N';
}

export interface IXCFaturaData {
  id: string;
  id_cliente: string;
  valor: string;
  valor_pago?: string;
  data_vencimento: string;
  data_pagamento?: string;
  status: 'A' | 'P' | 'C';
  pix_copia_e_cola?: string;
  url_boleto?: string;
}

export interface IXCApiResponse<T = any> {
  registros?: T[];
  total?: string | number;
}

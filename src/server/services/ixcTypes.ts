
export interface ISPFYParams {
  qtype: string;
  query: string;
  oper: '==' | '=' | '>' | '<' | '>=' | '<=' | 'L';
  page: string;
  rp: string;
  sortname: string;
  sortorder: 'asc' | 'desc';
}

export interface ISPFYClienteData {
  id: string;
  razao?: string;
  nome?: string;
  cnpj_cpf: string;
  telefone_celular?: string;
  fone_whatsapp?: string;
  email?: string;
  ativo: 'S' | 'N';
}

export interface ISPFYFaturaData {
  id: string;
  id_cliente: string;
  valor: string;
  valor_pago?: string;
  data_vencimento: string;
  data_pagamento?: string;
  status: 'A' | 'P' | 'C';
  pix_copia_e_cola?: string;
  url_boleto?: string;
  gateway_link?: string;
  link_getwere?: string;
  b_link_getwere?: string;
}

export interface ISPFYApiResponse<T = any> {
  registros?: T[];
  total?: string | number;
}

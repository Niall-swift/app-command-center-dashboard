import type { ISPFYClienteData, ISPFYContactData, ISPFYFaturaData } from '@/types/ispfy';
import type { WhapiGroup } from '@/types/whapi';

const ID_GRUPO_PADRAO_OS = '120363426874994471-group';

export interface ConfigPrioridadeOS {
  rotulo: string;
  corTexto: string;
  classeChip: string;
  classeBadge: string;
}

/**
 * Mapa unificado de prioridades das Ordens de Serviço ISPFY.
 */
export const ROTULOS_PRIORIDADE_OS: Record<string, ConfigPrioridadeOS> = {
  B: {
    rotulo: 'Baixa',
    corTexto: 'text-blue-600 dark:text-blue-400',
    classeChip: 'bg-blue-500/10 border-blue-500/30',
    classeBadge: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  },
  N: {
    rotulo: 'Normal',
    corTexto: 'text-emerald-600 dark:text-emerald-400',
    classeChip: 'bg-emerald-500/10 border-emerald-500/30',
    classeBadge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  },
  A: {
    rotulo: 'Alta',
    corTexto: 'text-orange-600 dark:text-orange-400',
    classeChip: 'bg-orange-500/10 border-orange-500/30',
    classeBadge: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
  },
  C: {
    rotulo: 'Crítica',
    corTexto: 'text-red-600 dark:text-red-400',
    classeChip: 'bg-red-500/10 border-red-500/30',
    classeBadge: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
  },
};

/**
 * Verifica se uma flag de ativo do ISPFY representa registro ativo ('S', '1' ou 'TRUE').
 */
export function isRegistroAtivo(valor?: string | number | boolean | null): boolean {
  if (typeof valor === 'boolean') return valor;
  const normalizado = String(valor ?? '').trim().toUpperCase();
  return normalizado === 'S' || normalizado === '1' || normalizado === 'TRUE';
}

/**
 * Verifica se uma data vinda da API está vazia ou zerada ('0000-00-00').
 */
export function isDataVaziaISPFY(valor?: string | null): boolean {
  if (!valor) return true;
  const limpo = String(valor).trim();
  return !limpo || limpo === '0000-00-00' || limpo.startsWith('0000-00-00');
}

/**
 * Verifica se uma fatura está realmente em aberto (status 'A'/'aberto', não paga e não excluída).
 */
export function isFaturaEmAberto(fatura?: Partial<ISPFYFaturaData> | null): boolean {
  if (!fatura) return false;
  const statusNormalizado = String(fatura.status || '').trim().toLowerCase();
  if (statusNormalizado && statusNormalizado !== 'aberto' && statusNormalizado !== 'a') {
    return false;
  }
  return (
    isDataVaziaISPFY(fatura.data_pagamento) &&
    isDataVaziaISPFY(fatura.pagamento_data) &&
    isDataVaziaISPFY((fatura as { data_exclusao?: string }).data_exclusao)
  );
}

/**
 * Extrai o nome ou razão social mais confiável de um cliente ISPFY.
 */
export function obterNomeClienteISPFY(
  cliente?: Partial<ISPFYContactData> | null,
  padrao = 'Sem nome'
): string {
  if (!cliente) return padrao;
  return String(cliente.nome_razao || cliente.nome || cliente.razao || '').trim() || padrao;
}

/**
 * Extrai o melhor telefone/WhatsApp disponível de um cliente ISPFY.
 */
export function obterTelefoneClienteISPFY(
  cliente?: Partial<ISPFYContactData> | null,
  padrao = ''
): string {
  if (!cliente) return padrao;
  const extra = cliente as Record<string, unknown>;
  const candidato =
    cliente.fone_whatsapp ||
    extra.whatsapp ||
    cliente.fone_celular ||
    cliente.telefone_celular ||
    extra.celular ||
    extra.telefone ||
    extra.fone ||
    cliente.fone_residencial ||
    '';
  return String(candidato).trim() || padrao;
}

/**
 * Monta o endereço formatado completo de um cliente ISPFY.
 */
export function montarEnderecoISPFY(cliente?: Partial<ISPFYContactData> | null): string {
  if (!cliente) return '';
  const partes: string[] = [];
  const rua = cliente.endereco_cobranca_rua || cliente.endereco;
  const numero = cliente.endereco_cobranca_numero;
  const bairro = cliente.endereco_cobranca_bairro || cliente.bairro;
  const cidade = cliente.cidade;
  const cep = cliente.endereco_cobranca_cep || cliente.cep;

  if (rua) partes.push(numero ? `${rua}, ${numero}` : rua);
  if (bairro) partes.push(bairro);
  if (cidade) partes.push(cidade);
  if (cep) partes.push(cep);
  return partes.join(' – ');
}

/**
 * Gera os links direto e incorporado (iframe) do Google Maps para um cliente ISPFY.
 */
export function gerarLinksMapaCliente(cliente?: Partial<ISPFYContactData> | null): {
  urlDireta: string;
  urlIncorporada: string;
} {
  if (!cliente) return { urlDireta: '', urlIncorporada: '' };
  const lat = cliente.endereco_cobranca_latitude || cliente.latitude;
  const lng = cliente.endereco_cobranca_longitude || cliente.longitude;
  const possuiCoordenadas =
    Boolean(lat && lng) &&
    lat !== '0' &&
    lat !== '0.0000000' &&
    lng !== '0' &&
    lng !== '0.0000000';

  if (possuiCoordenadas) {
    return {
      urlDireta: `https://maps.google.com/?q=${lat},${lng}`,
      urlIncorporada: `https://maps.google.com/maps?q=${lat},${lng}&z=16&output=embed`,
    };
  }

  const endereco = montarEnderecoISPFY(cliente);
  if (!endereco) return { urlDireta: '', urlIncorporada: '' };
  const codificado = encodeURIComponent(endereco);
  return {
    urlDireta: `https://maps.google.com/?q=${codificado}`,
    urlIncorporada: `https://maps.google.com/maps?q=${codificado}&z=16&output=embed`,
  };
}

/**
 * Formata CPF (11 dígitos) ou CNPJ (14 dígitos), mantendo o valor original nos demais casos.
 */
export function formatarDocumentoCpfCnpj(documento?: string | null, fallback = ''): string {
  const bruto = String(documento || '').trim();
  const limpo = bruto.replace(/\D/g, '');
  if (limpo.length === 11) {
    return limpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
  if (limpo.length === 14) {
    return limpo.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }
  return bruto || fallback;
}

/**
 * Formata tráfego informado em Kbytes para KB, MB ou GB legíveis.
 */
export function formatarConsumoDados(kbytes?: number): string {
  if (kbytes === undefined || isNaN(kbytes)) return '';
  if (kbytes >= 1024 * 1024) return `${(kbytes / (1024 * 1024)).toFixed(2)} GB`;
  if (kbytes >= 1024) return `${(kbytes / 1024).toFixed(1)} MB`;
  return `${kbytes} KB`;
}

/**
 * Seleciona automaticamente o grupo operacional padrão do WhatsApp na lista retornada pela Whapi.
 */
export function selecionarGrupoWhatsAppPadrao(grupos: WhapiGroup[]): WhapiGroup | undefined {
  if (!grupos || grupos.length === 0) return undefined;
  return (
    grupos.find(
      (grupo) =>
        grupo.phone === ID_GRUPO_PADRAO_OS ||
        grupo.name.toUpperCase().includes('OPERAÇÃO') ||
        grupo.name.toUpperCase().includes('EQUIPE')
    ) || grupos[0]
  );
}

/**
 * Busca híbrida de clientes ISPFY: filtra primeiro em memória e recorre à API apenas se necessário.
 */
export async function buscarClientesISPFYHibrido(
  termo: string,
  clientesEmMemoria: ISPFYClienteData[],
  apiBusca: {
    getClienteByPhone: (tel: string) => Promise<ISPFYClienteData | null>;
    getClienteByCnpjCpf: (doc: string) => Promise<ISPFYClienteData | null>;
    getClienteByNome: (nome: string) => Promise<ISPFYClienteData[]>;
  }
): Promise<ISPFYClienteData[]> {
  const consulta = termo.trim().toLowerCase();
  if (!consulta) return clientesEmMemoria;

  const correspondenciasLocais = clientesEmMemoria.filter((cliente) => {
    const nome = obterNomeClienteISPFY(cliente, '').toLowerCase();
    const id = cliente.id ? String(cliente.id).toLowerCase() : '';
    const telefone = obterTelefoneClienteISPFY(cliente);
    return (
      nome.includes(consulta) ||
      id.includes(consulta) ||
      telefone.includes(consulta)
    );
  });
  if (correspondenciasLocais.length > 0) return correspondenciasLocais;

  const digitos = termo.replace(/\D/g, '');
  const somenteNumerico = /^\d+$/.test(termo.replace(/[-.() ]/g, ''));

  if (somenteNumerico) {
    if (digitos.length >= 10 && digitos.length <= 11) {
      const porTelefone = await apiBusca.getClienteByPhone(digitos);
      if (porTelefone) return [porTelefone];
    }
    if (digitos.length === 11 || digitos.length === 14) {
      const porDocumento = await apiBusca.getClienteByCnpjCpf(digitos);
      if (porDocumento) return [porDocumento];
    }
  }

  const porNome = await apiBusca.getClienteByNome(termo);
  return porNome.length > 0 ? porNome : [];
}


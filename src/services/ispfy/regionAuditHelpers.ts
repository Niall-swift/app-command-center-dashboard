import type {
  ISPFYClientRegionRecord,
  ISPFYConnectionHealthStatus,
  ISPFYRegionGroupSummary,
  ISPFYStreetGroupSummary,
} from '@/types/ispfy';

export const EMPTY_BAIRRO_KEY = '__SEM_BAIRRO__';
export const EMPTY_STREET_KEY = '__SEM_ENDERECO__';
export const EMPTY_BAIRRO_LABEL = '(Sem bairro informado)';
export const EMPTY_STREET_LABEL = '(Sem endereço informado)';

const LOWER_PORTUGUESE_CONNECTORS = new Set([
  'da',
  'de',
  'do',
  'das',
  'dos',
  'e',
  'em',
  'na',
  'no',
  'nas',
  'nos',
  'com',
  'para',
]);

const UPPER_ACRONYMS_AND_ROMANS = new Set([
  'II',
  'III',
  'IV',
  'VI',
  'VII',
  'VIII',
  'IX',
  'BR',
  'RJ',
  'SP',
  'MG',
  'ES',
  'KM',
  'SN',
  'S/N',
]);

const STREET_PREFIX_MAP: Record<string, string> = {
  R: 'RUA',
  RUA: 'RUA',
  AV: 'AVENIDA',
  AVDA: 'AVENIDA',
  AVENIDA: 'AVENIDA',
  EST: 'ESTRADA',
  ESTR: 'ESTRADA',
  ESTRADA: 'ESTRADA',
  TV: 'TRAVESSA',
  TRAV: 'TRAVESSA',
  TRAVESSA: 'TRAVESSA',
  AL: 'ALAMEDA',
  ALAMEDA: 'ALAMEDA',
  PCA: 'PRACA',
  PRACA: 'PRACA',
  ROD: 'RODOVIA',
  RODOVIA: 'RODOVIA',
  BEC: 'BECO',
  BECO: 'BECO',
  VD: 'VIADUTO',
  LG: 'LARGO',
  LARGO: 'LARGO',
  SERV: 'SERVIDAO',
  SERVIDAO: 'SERVIDAO',
  CAM: 'CAMINHO',
  LOT: 'LOTEAMENTO',
};

/**
 * Normaliza texto para buscas e chaves canônicas (remove acentos e colapsa espaços).
 */
export function normalizeAsciiUpper(raw?: string | null): string {
  return String(raw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeBairroKey(raw?: string | null): string {
  const cleaned = normalizeAsciiUpper(raw)
    .replace(/^[-.,;:/\\\s]+|[-.,;:/\\\s]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned || cleaned === 'NAO INFORMADO' || cleaned === 'N/I' || cleaned === '-') {
    return EMPTY_BAIRRO_KEY;
  }
  return cleaned;
}

export function normalizeStreetKey(raw?: string | null): string {
  const cleaned = normalizeAsciiUpper(raw)
    .replace(/[.,;]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned || cleaned === 'NAO INFORMADO' || cleaned === 'N/I' || cleaned === '-') {
    return EMPTY_STREET_KEY;
  }

  const tokens = cleaned.split(' ');
  const mappedPrefix = STREET_PREFIX_MAP[tokens[0]];
  if (mappedPrefix && tokens.length > 1) {
    tokens[0] = mappedPrefix;
  }
  return tokens.join(' ');
}

/**
 * Formata nomes de bairros/ruas em Title Case natural em português,
 * corrigindo maiúsculas/minúsculas misturadas (ex: "RUA DOIS IRMãOS" -> "Rua Dois Irmãos").
 */
export function formatLocationDisplay(raw?: string | null): string {
  const collapsed = String(raw || '').replace(/\s+/g, ' ').trim();
  if (!collapsed) return '';

  const lowerTokens = collapsed.toLowerCase().split(' ');
  return lowerTokens
    .map((token, idx) => {
      const upper = token.toUpperCase();
      if (UPPER_ACRONYMS_AND_ROMANS.has(upper)) return upper;
      if (idx > 0 && LOWER_PORTUGUESE_CONNECTORS.has(token)) return token;
      return token.charAt(0).toUpperCase() + token.slice(1);
    })
    .join(' ');
}

/**
 * Seleciona a melhor grafia observada para um bairro ou rua (priorizando variantes acentuadas corretas).
 */
export function pickBestVariantLabel(
  variants: Map<string, number>,
  fallbackLabel: string
): string {
  if (variants.size === 0) return fallbackLabel;

  let bestText = '';
  let bestScore = -1;

  variants.forEach((count, text) => {
    const hasDiacritics = /[\u00C0-\u024F]/.test(text);
    // Bônus leve para variantes com acentuação correta em português
    const score = count + (hasDiacritics ? 1000 : 0);
    if (score > bestScore) {
      bestScore = score;
      bestText = text;
    }
  });

  return formatLocationDisplay(bestText) || fallbackLabel;
}

/**
 * Classifica a saúde real da conexão de um ponto ISPFY cruzando contrato, bloqueio de pool e sessão PPPoE.
 */
export function classifyPointConnectionHealth(params: {
  contratoAtivo?: string | null;
  pontoAtivo?: string | null;
  statusContrato?: string | null;
  poolSobreposta?: string | null;
  sessaoConexaoStatus?: string | null;
  bloqueadoFlag?: boolean | string | number | null;
}): {
  connectionHealth: ISPFYConnectionHealthStatus;
  isOnline: boolean;
  isBlocked: boolean;
  isContractActive: boolean;
} {
  const ctAtivo = String(params.contratoAtivo ?? 's').toLowerCase();
  const ptAtivo = String(params.pontoAtivo ?? 's').toLowerCase();
  const statusCt = String(params.statusContrato ?? '').toLowerCase();
  const pool = String(params.poolSobreposta ?? '').toLowerCase();
  const conn = String(params.sessaoConexaoStatus ?? 'offline').toLowerCase();
  const explicitBlocked =
    params.bloqueadoFlag === true ||
    params.bloqueadoFlag === 1 ||
    params.bloqueadoFlag === '1';

  const isContractActive = ctAtivo !== 'n' && ptAtivo !== 'n';
  const isBlocked =
    explicitBlocked || statusCt === 'bloqueado' || pool === 'bloqueado';
  const isOnline = conn === 'online';

  let connectionHealth: ISPFYConnectionHealthStatus;
  if (!isContractActive) {
    connectionHealth = 'inativo';
  } else if (isBlocked) {
    connectionHealth = isOnline ? 'bloqueado_online' : 'bloqueado_offline';
  } else {
    connectionHealth = isOnline ? 'ok' : 'desconectado';
  }

  return {
    connectionHealth,
    isOnline,
    isBlocked,
    isContractActive,
  };
}

interface MutableAccumulator {
  key: string;
  label: string;
  bairroKey?: string;
  bairroLabel?: string;
  ruaKey?: string;
  clienteIds: Set<string>;
  totalPontos: number;
  internetOk: number;
  desconectados: number;
  bloqueados: number;
  bloqueadosOnline: number;
  bloqueadosOffline: number;
  inativos: number;
}

function accumulateHealth(acc: MutableAccumulator, rec: ISPFYClientRegionRecord): void {
  acc.totalPontos += 1;
  if (rec.clienteId) acc.clienteIds.add(rec.clienteId);

  switch (rec.connectionHealth) {
    case 'ok':
      acc.internetOk += 1;
      break;
    case 'desconectado':
      acc.desconectados += 1;
      break;
    case 'bloqueado_online':
      acc.bloqueados += 1;
      acc.bloqueadosOnline += 1;
      break;
    case 'bloqueado_offline':
      acc.bloqueados += 1;
      acc.bloqueadosOffline += 1;
      break;
    case 'inativo':
      acc.inativos += 1;
      break;
  }
}

function finalizeSummary(acc: MutableAccumulator): ISPFYRegionGroupSummary {
  const ativosSemInativo = Math.max(0, acc.totalPontos - acc.inativos);
  const onlineRate =
    ativosSemInativo > 0
      ? Math.round((acc.internetOk / ativosSemInativo) * 1000) / 10
      : 0;

  return {
    key: acc.key,
    label: acc.label,
    totalPontos: acc.totalPontos,
    totalClientesUnicos: acc.clienteIds.size || acc.totalPontos,
    internetOk: acc.internetOk,
    desconectados: acc.desconectados,
    bloqueados: acc.bloqueados,
    bloqueadosOnline: acc.bloqueadosOnline,
    bloqueadosOffline: acc.bloqueadosOffline,
    inativos: acc.inativos,
    onlineRate,
  };
}

/**
 * Agrupa registros por Bairro e por Rua/Logradouro (dentro de cada bairro),
 * gerando quantitativos exatos de Internet OK, Desconectados e Bloqueados.
 */
export function aggregateRegionSummaries(records: ISPFYClientRegionRecord[]): {
  bairros: ISPFYRegionGroupSummary[];
  ruas: ISPFYStreetGroupSummary[];
  totals: {
    totalPontos: number;
    totalAtivos: number;
    totalClientesUnicos: number;
    internetOk: number;
    desconectados: number;
    bloqueados: number;
    bloqueadosOnline: number;
    bloqueadosOffline: number;
    inativos: number;
  };
} {
  const bairroMap = new Map<string, MutableAccumulator>();
  const ruaMap = new Map<string, MutableAccumulator>();
  const globalClients = new Set<string>();

  const totalsAcc: MutableAccumulator = {
    key: 'ALL',
    label: 'Todos',
    clienteIds: globalClients,
    totalPontos: 0,
    internetOk: 0,
    desconectados: 0,
    bloqueados: 0,
    bloqueadosOnline: 0,
    bloqueadosOffline: 0,
    inativos: 0,
  };

  for (const rec of records) {
    accumulateHealth(totalsAcc, rec);

    let bairroAcc = bairroMap.get(rec.bairroKey);
    if (!bairroAcc) {
      bairroAcc = {
        key: rec.bairroKey,
        label: rec.bairroLabel,
        clienteIds: new Set<string>(),
        totalPontos: 0,
        internetOk: 0,
        desconectados: 0,
        bloqueados: 0,
        bloqueadosOnline: 0,
        bloqueadosOffline: 0,
        inativos: 0,
      };
      bairroMap.set(rec.bairroKey, bairroAcc);
    }
    accumulateHealth(bairroAcc, rec);

    const compositeStreetKey = `${rec.bairroKey}::${rec.ruaKey}`;
    let ruaAcc = ruaMap.get(compositeStreetKey);
    if (!ruaAcc) {
      ruaAcc = {
        key: compositeStreetKey,
        label: rec.ruaLabel,
        bairroKey: rec.bairroKey,
        bairroLabel: rec.bairroLabel,
        ruaKey: rec.ruaKey,
        clienteIds: new Set<string>(),
        totalPontos: 0,
        internetOk: 0,
        desconectados: 0,
        bloqueados: 0,
        bloqueadosOnline: 0,
        bloqueadosOffline: 0,
        inativos: 0,
      };
      ruaMap.set(compositeStreetKey, ruaAcc);
    }
    accumulateHealth(ruaAcc, rec);
  }

  const bairros = Array.from(bairroMap.values())
    .map(finalizeSummary)
    .sort((a, b) => b.totalPontos - a.totalPontos || a.label.localeCompare(b.label, 'pt-BR'));

  const ruas: ISPFYStreetGroupSummary[] = Array.from(ruaMap.values())
    .map((acc) => ({
      ...finalizeSummary(acc),
      bairroKey: acc.bairroKey || EMPTY_BAIRRO_KEY,
      bairroLabel: acc.bairroLabel || EMPTY_BAIRRO_LABEL,
      ruaKey: acc.ruaKey || EMPTY_STREET_KEY,
    }))
    .sort((a, b) => b.totalPontos - a.totalPontos || a.label.localeCompare(b.label, 'pt-BR'));

  return {
    bairros,
    ruas,
    totals: {
      totalPontos: totalsAcc.totalPontos,
      totalAtivos: totalsAcc.totalPontos - totalsAcc.inativos,
      totalClientesUnicos: globalClients.size,
      internetOk: totalsAcc.internetOk,
      desconectados: totalsAcc.desconectados,
      bloqueados: totalsAcc.bloqueados,
      bloqueadosOnline: totalsAcc.bloqueadosOnline,
      bloqueadosOffline: totalsAcc.bloqueadosOffline,
      inativos: totalsAcc.inativos,
    },
  };
}


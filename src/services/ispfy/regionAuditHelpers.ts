import type {
  ISPFYClientRegionRecord,
  ISPFYConnectionHealthStatus,
  ISPFYConnectionTransitionEvent,
  ISPFYConnectionTransitionType,
  ISPFYRegionGroupSummary,
  ISPFYStreetGroupSummary,
} from '@/types/ispfy';

export const CHAVE_BAIRRO_VAZIO = '__SEM_BAIRRO__';
export const CHAVE_RUA_VAZIA = '__SEM_ENDERECO__';
export const ROTULO_BAIRRO_VAZIO = '(Sem bairro informado)';
export const ROTULO_RUA_VAZIA = '(Sem endereço informado)';

const CONECTORES_MINUSCULOS_PT = new Set([
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

const SIGLAS_E_ROMANOS_MAIUSCULOS = new Set([
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

const MAPA_PREFIXOS_LOGRADOURO: Record<string, string> = {
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

interface AcumuladorGrupoRegiao {
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

/**
 * Remove acentuação, converte para maiúsculas e colapsa espaços para comparações e chaves canônicas.
 */
export function normalizarTextoSemAcento(texto?: string | null): string {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizarChaveBairro(bruto?: string | null): string {
  const limpo = normalizarTextoSemAcento(bruto)
    .replace(/^[-.,;:/\\\s]+|[-.,;:/\\\s]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!limpo || limpo === 'NAO INFORMADO' || limpo === 'N/I' || limpo === '-') {
    return CHAVE_BAIRRO_VAZIO;
  }
  return limpo;
}

export function normalizarChaveRua(bruto?: string | null): string {
  const limpo = normalizarTextoSemAcento(bruto)
    .replace(/[.,;]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!limpo || limpo === 'NAO INFORMADO' || limpo === 'N/I' || limpo === '-') {
    return CHAVE_RUA_VAZIA;
  }

  const palavras = limpo.split(' ');
  const prefixoPadronizado = MAPA_PREFIXOS_LOGRADOURO[palavras[0]];
  if (prefixoPadronizado && palavras.length > 1) {
    palavras[0] = prefixoPadronizado;
  }
  return palavras.join(' ');
}

/**
 * Formata nomes de bairros e logradouros em Title Case natural em português.
 */
export function formatarExibicaoLocalidade(bruto?: string | null): string {
  const colapsado = String(bruto || '').replace(/\s+/g, ' ').trim();
  if (!colapsado) return '';

  return colapsado
    .toLowerCase()
    .split(' ')
    .map((palavra, indice) => {
      const maiuscula = palavra.toUpperCase();
      if (SIGLAS_E_ROMANOS_MAIUSCULOS.has(maiuscula)) return maiuscula;
      if (indice > 0 && CONECTORES_MINUSCULOS_PT.has(palavra)) return palavra;
      return palavra.charAt(0).toUpperCase() + palavra.slice(1);
    })
    .join(' ');
}

/**
 * Seleciona a melhor grafia observada para um bairro ou rua (priorizando variantes acentuadas).
 */
export function escolherMelhorGrafia(
  variantes: Map<string, number>,
  rotuloPadrao: string
): string {
  if (variantes.size === 0) return rotuloPadrao;

  let melhorTexto = '';
  let melhorPontuacao = -1;

  variantes.forEach((contagem, texto) => {
    const possuiAcentos = /[\u00C0-\u024F]/.test(texto);
    const pontuacao = contagem + (possuiAcentos ? 1000 : 0);
    if (pontuacao > melhorPontuacao) {
      melhorPontuacao = pontuacao;
      melhorTexto = texto;
    }
  });

  return formatarExibicaoLocalidade(melhorTexto) || rotuloPadrao;
}

/**
 * Classifica a saúde real da conexão de um ponto ISPFY cruzando contrato, bloqueio e sessão PPPoE.
 */
export function classificarSaudeConexaoPonto(params: {
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
  const contratoAtivo = String(params.contratoAtivo ?? 's').toLowerCase() !== 'n';
  const pontoAtivo = String(params.pontoAtivo ?? 's').toLowerCase() !== 'n';
  const statusContrato = String(params.statusContrato ?? '').toLowerCase();
  const pool = String(params.poolSobreposta ?? '').toLowerCase();
  const statusConexao = String(params.sessaoConexaoStatus ?? 'offline').toLowerCase();

  const bloqueioExplicito =
    params.bloqueadoFlag === true ||
    params.bloqueadoFlag === 1 ||
    params.bloqueadoFlag === '1';

  const isContractActive = contratoAtivo && pontoAtivo;
  const isBlocked =
    bloqueioExplicito || statusContrato === 'bloqueado' || pool === 'bloqueado';
  const isOnline = statusConexao === 'online';

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

function criarAcumuladorGrupo(
  chave: string,
  rotulo: string,
  extras?: Partial<Pick<AcumuladorGrupoRegiao, 'bairroKey' | 'bairroLabel' | 'ruaKey'>>
): AcumuladorGrupoRegiao {
  return {
    key: chave,
    label: rotulo,
    ...extras,
    clienteIds: new Set<string>(),
    totalPontos: 0,
    internetOk: 0,
    desconectados: 0,
    bloqueados: 0,
    bloqueadosOnline: 0,
    bloqueadosOffline: 0,
    inativos: 0,
  };
}

function acumularSaudePonto(
  acumulador: AcumuladorGrupoRegiao,
  registro: ISPFYClientRegionRecord
): void {
  acumulador.totalPontos += 1;
  if (registro.clienteId) acumulador.clienteIds.add(registro.clienteId);

  switch (registro.connectionHealth) {
    case 'ok':
      acumulador.internetOk += 1;
      break;
    case 'desconectado':
      acumulador.desconectados += 1;
      break;
    case 'bloqueado_online':
      acumulador.bloqueados += 1;
      acumulador.bloqueadosOnline += 1;
      break;
    case 'bloqueado_offline':
      acumulador.bloqueados += 1;
      acumulador.bloqueadosOffline += 1;
      break;
    case 'inativo':
      acumulador.inativos += 1;
      break;
  }
}

function finalizarResumoRegiao(
  acumulador: AcumuladorGrupoRegiao
): ISPFYRegionGroupSummary {
  const ativosSemInativo = Math.max(0, acumulador.totalPontos - acumulador.inativos);
  const taxaOnline =
    ativosSemInativo > 0
      ? Math.round((acumulador.internetOk / ativosSemInativo) * 1000) / 10
      : 0;

  return {
    key: acumulador.key,
    label: acumulador.label,
    totalPontos: acumulador.totalPontos,
    totalClientesUnicos: acumulador.clienteIds.size || acumulador.totalPontos,
    internetOk: acumulador.internetOk,
    desconectados: acumulador.desconectados,
    bloqueados: acumulador.bloqueados,
    bloqueadosOnline: acumulador.bloqueadosOnline,
    bloqueadosOffline: acumulador.bloqueadosOffline,
    inativos: acumulador.inativos,
    onlineRate: taxaOnline,
  };
}

/**
 * Agrupa registros por Bairro e por Rua/Logradouro (dentro de cada bairro),
 * gerando quantitativos exatos de Internet OK, Desconectados e Bloqueados.
 */
export function agregarResumosPorRegiao(registros: ISPFYClientRegionRecord[]): {
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
  const mapaBairros = new Map<string, AcumuladorGrupoRegiao>();
  const mapaRuas = new Map<string, AcumuladorGrupoRegiao>();
  const acumuladorGeral = criarAcumuladorGrupo('ALL', 'Todos');

  for (const registro of registros) {
    acumularSaudePonto(acumuladorGeral, registro);

    let acumuladorBairro = mapaBairros.get(registro.bairroKey);
    if (!acumuladorBairro) {
      acumuladorBairro = criarAcumuladorGrupo(registro.bairroKey, registro.bairroLabel);
      mapaBairros.set(registro.bairroKey, acumuladorBairro);
    }
    acumularSaudePonto(acumuladorBairro, registro);

    const chaveRuaComposta = `${registro.bairroKey}::${registro.ruaKey}`;
    let acumuladorRua = mapaRuas.get(chaveRuaComposta);
    if (!acumuladorRua) {
      acumuladorRua = criarAcumuladorGrupo(chaveRuaComposta, registro.ruaLabel, {
        bairroKey: registro.bairroKey,
        bairroLabel: registro.bairroLabel,
        ruaKey: registro.ruaKey,
      });
      mapaRuas.set(chaveRuaComposta, acumuladorRua);
    }
    acumularSaudePonto(acumuladorRua, registro);
  }

  const bairros = Array.from(mapaBairros.values())
    .map(finalizarResumoRegiao)
    .sort((a, b) => b.totalPontos - a.totalPontos || a.label.localeCompare(b.label, 'pt-BR'));

  const ruas: ISPFYStreetGroupSummary[] = Array.from(mapaRuas.values())
    .map((acumulador) => ({
      ...finalizarResumoRegiao(acumulador),
      bairroKey: acumulador.bairroKey || CHAVE_BAIRRO_VAZIO,
      bairroLabel: acumulador.bairroLabel || ROTULO_BAIRRO_VAZIO,
      ruaKey: acumulador.ruaKey || CHAVE_RUA_VAZIA,
    }))
    .sort((a, b) => b.totalPontos - a.totalPontos || a.label.localeCompare(b.label, 'pt-BR'));

  return {
    bairros,
    ruas,
    totals: {
      totalPontos: acumuladorGeral.totalPontos,
      totalAtivos: acumuladorGeral.totalPontos - acumuladorGeral.inativos,
      totalClientesUnicos: acumuladorGeral.clienteIds.size,
      internetOk: acumuladorGeral.internetOk,
      desconectados: acumuladorGeral.desconectados,
      bloqueados: acumuladorGeral.bloqueados,
      bloqueadosOnline: acumuladorGeral.bloqueadosOnline,
      bloqueadosOffline: acumuladorGeral.bloqueadosOffline,
      inativos: acumuladorGeral.inativos,
    },
  };
}

function criarEventoTransicaoConexao(
  tipo: ISPFYConnectionTransitionType,
  registro: ISPFYClientRegionRecord,
  ocorridoEm: string
): ISPFYConnectionTransitionEvent {
  const prefixo = tipo === 'dropped' ? 'queda' : 'reconexao';
  return {
    id: `${prefixo}_${registro.pontoId}_${ocorridoEm}`,
    type: tipo,
    occurredAt: ocorridoEm,
    pontoId: registro.pontoId,
    clienteId: registro.clienteId,
    contratoId: registro.contratoId,
    nome: registro.nome,
    telefone: registro.telefone,
    bairroKey: registro.bairroKey,
    bairroLabel: registro.bairroLabel,
    ruaLabel: registro.ruaLabel,
    enderecoCompleto: registro.enderecoCompleto,
    plano: registro.plano,
    usuarioPppoe: registro.usuarioPppoe,
    ultimoLogin: registro.ultimoLogin,
  };
}

/**
 * Compara o estado anterior e atual de todos os pontos para detectar em tempo real
 * clientes que acabaram de ficar sem internet (ok -> desconectado) ou voltaram online.
 */
export function detectarTransicoesConexao(
  registrosAnteriores: ISPFYClientRegionRecord[],
  registrosAtuais: ISPFYClientRegionRecord[],
  ocorridoEm: string = new Date().toISOString()
): {
  quedas: ISPFYConnectionTransitionEvent[];
  reconexoes: ISPFYConnectionTransitionEvent[];
} {
  if (registrosAnteriores.length === 0 || registrosAtuais.length === 0) {
    return { quedas: [], reconexoes: [] };
  }

  const anteriorPorPonto = new Map<string, ISPFYClientRegionRecord>();
  for (const registro of registrosAnteriores) {
    if (registro.pontoId) anteriorPorPonto.set(registro.pontoId, registro);
  }

  const quedas: ISPFYConnectionTransitionEvent[] = [];
  const reconexoes: ISPFYConnectionTransitionEvent[] = [];

  for (const atual of registrosAtuais) {
    if (!atual.pontoId) continue;
    const anterior = anteriorPorPonto.get(atual.pontoId);
    if (!anterior) continue;

    // Queda real: estava com internet OK e ficou desconectado (sem bloqueio ou cancelamento)
    if (anterior.connectionHealth === 'ok' && atual.connectionHealth === 'desconectado') {
      quedas.push(criarEventoTransicaoConexao('dropped', atual, ocorridoEm));
    } else if (
      anterior.connectionHealth === 'desconectado' &&
      atual.connectionHealth === 'ok'
    ) {
      reconexoes.push(criarEventoTransicaoConexao('reconnected', atual, ocorridoEm));
    }
  }

  return { quedas, reconexoes };
}

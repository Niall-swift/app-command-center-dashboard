import type {
  ISPFYClientRegionRecord,
  ISPFYConnectionHealthStatus,
  ISPFYConnectionTransitionEvent,
  ISPFYConnectionTransitionType,
  ISPFYMassOutageAlert,
  ISPFYOutageDetectionConfig,
  ISPFYRegionGroupSummary,
  ISPFYStreetGroupSummary,
} from '@/types/ispfy';

export const DEFAULT_OUTAGE_DETECTION_CONFIG: ISPFYOutageDetectionConfig = {
  minClientesOfflineRua: 4,
  minPercentualRua: 50,
  minClientesOfflineBairro: 6,
  minPercentualBairro: 35,
  ignorarOfflineAntigoHoras: 72,
  confirmarAoVivoAntesEnviar: true,
  minChecagensConsecutivas: 4,
};

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

/**
/**
 * Gera chave segura para ID de documento Firestore a partir de bairro/rua normalizados.
 */
export function sanitizeOutageIncidentKey(raw: string): string {
  const cleaned = String(raw || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  return (cleaned || 'regiao').slice(0, 120);
}

/** Interpreta datas retornadas pela API ISPFY considerando fuso de Brasília (-03:00) quando sem timezone. */
export function parseIspfyTimestampMs(raw?: string | null): number | null {
  const texto = String(raw || '').trim();
  if (
    !texto ||
    texto === '-' ||
    texto === '0000-00-00 00:00:00' ||
    texto === '0000-00-00'
  ) {
    return null;
  }

  const matchBr = texto.match(
    /^(\d{2})\/(\d{2})\/(\d{4})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/
  );
  if (matchBr) {
    const [, dd, mm, yyyy, hh = '00', mi = '00', ss = '00'] = matchBr;
    const ms = Date.parse(`${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}-03:00`);
    return Number.isFinite(ms) ? ms : null;
  }

  const matchIsoNoTz = texto.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/
  );
  if (matchIsoNoTz) {
    const [, yyyy, mm, dd, hh = '00', mi = '00', ss = '00'] = matchIsoNoTz;
    const ms = Date.parse(`${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}-03:00`);
    return Number.isFinite(ms) ? ms : null;
  }

  const fallback = Date.parse(texto);
  return Number.isFinite(fallback) ? fallback : null;
}

/** Verifica se o ponto já está desconectado há mais tempo do que a janela de corte (ex.: 72h). */
export function pontoEstaOfflineCronico(
  ultimoLogin?: string | null,
  ultimoAccounting?: string | null,
  maxHoras = 72,
  referenciaMs = Date.now()
): boolean {
  if (!maxHoras || maxHoras <= 0) return false;
  const loginMs = parseIspfyTimestampMs(ultimoLogin);
  const accMs = parseIspfyTimestampMs(ultimoAccounting);
  const maisRecenteMs =
    loginMs !== null && accMs !== null
      ? Math.max(loginMs, accMs)
      : loginMs ?? accMs;
  if (maisRecenteMs === null) return false;
  return referenciaMs - maisRecenteMs > maxHoras * 60 * 60 * 1000;
}

/**
 * Agrupa clientes únicos ativos por rua e bairro para identificar rompimentos reais de fibra em massa.
 * Aplica proteções anti-falso-positivo:
 * - Disjuntor global se < 10% da base estiver online (falha de leitura API/RADIUS ou queda global);
 * - Deduplicação por cliente único (evita inflar 1 assinante com múltiplos logins PPPoE);
 * - Exclusão de pontos offline crônicos (sem login há mais de `ignorarOfflineAntigoHoras`);
 * - Mínimo de clientes únicos e percentual mínimo configuráveis por rua e bairro.
 */
export function detectarRompimentosEmMassa(
  registros: ISPFYClientRegionRecord[],
  opcoes?: Partial<ISPFYOutageDetectionConfig>
): ISPFYMassOutageAlert[] {
  const cfg: ISPFYOutageDetectionConfig = {
    ...DEFAULT_OUTAGE_DETECTION_CONFIG,
    ...(opcoes || {}),
  };

  const minStreetOffline = Math.max(2, Number(cfg.minClientesOfflineRua || 4));
  const minStreetRatio = Math.max(
    0.1,
    Math.min(1, Number(cfg.minPercentualRua || 50) / 100)
  );
  const minOffline = Math.max(2, Number(cfg.minClientesOfflineBairro || 6));
  const minRatio = Math.max(
    0.1,
    Math.min(1, Number(cfg.minPercentualBairro || 35) / 100)
  );
  const maxOfflineHoras = Math.max(0, Number(cfg.ignorarOfflineAntigoHoras ?? 72));
  const agoraMs = Date.now();

  let totalPontosAtivosGlobais = 0;
  let totalPontosOnlineGlobais = 0;
  for (const reg of registros) {
    if (reg.connectionHealth === 'inativo') continue;
    totalPontosAtivosGlobais += 1;
    if (reg.connectionHealth === 'ok') {
      totalPontosOnlineGlobais += 1;
    }
  }

  // Disjuntor global: se toda a rede/API aparecer offline ou < 10% online, bloqueia alertas por rua
  if (
    totalPontosAtivosGlobais >= 20 &&
    (totalPontosOnlineGlobais === 0 ||
      totalPontosOnlineGlobais < Math.max(5, Math.floor(totalPontosAtivosGlobais * 0.1)))
  ) {
    return [];
  }

  interface RuaAccumulator {
    ruaKey: string;
    ruaLabel: string;
    clientesUnicos: Set<string>;
    clientesOnline: Set<string>;
    clientesOfflineCandidatos: Map<string, string>;
    clienteIdsOffline: Set<string>;
    pontoIds: string[];
    offlineAntigosIgnorados: number;
  }

  interface BairroAccumulator {
    bairroKey: string;
    bairroLabel: string;
    clientesUnicos: Set<string>;
    clientesOnline: Set<string>;
    clientesOfflineCandidatos: Map<string, string>;
    clienteIdsOffline: Set<string>;
    pontoIds: string[];
    offlineAntigosIgnorados: number;
    ruas: Map<string, RuaAccumulator>;
  }

  const grupos = new Map<string, BairroAccumulator>();

  for (const reg of registros) {
    if (reg.connectionHealth === 'inativo') continue;
    if (reg.bairroKey === CHAVE_BAIRRO_VAZIO) continue;

    const clienteKey = reg.clienteId
      ? `cli:${reg.clienteId}`
      : reg.contratoId
      ? `ct:${reg.contratoId}`
      : `pt:${reg.pontoId}`;

    let grupo = grupos.get(reg.bairroKey);
    if (!grupo) {
      grupo = {
        bairroKey: reg.bairroKey,
        bairroLabel: reg.bairroLabel,
        clientesUnicos: new Set<string>(),
        clientesOnline: new Set<string>(),
        clientesOfflineCandidatos: new Map<string, string>(),
        clienteIdsOffline: new Set<string>(),
        pontoIds: [],
        offlineAntigosIgnorados: 0,
        ruas: new Map<string, RuaAccumulator>(),
      };
      grupos.set(reg.bairroKey, grupo);
    }

    grupo.clientesUnicos.add(clienteKey);

    let ruaStat = grupo.ruas.get(reg.ruaKey);
    if (!ruaStat) {
      ruaStat = {
        ruaKey: reg.ruaKey,
        ruaLabel: reg.ruaLabel,
        clientesUnicos: new Set<string>(),
        clientesOnline: new Set<string>(),
        clientesOfflineCandidatos: new Map<string, string>(),
        clienteIdsOffline: new Set<string>(),
        pontoIds: [],
        offlineAntigosIgnorados: 0,
      };
      grupo.ruas.set(reg.ruaKey, ruaStat);
    }
    ruaStat.clientesUnicos.add(clienteKey);

    if (reg.connectionHealth === 'ok') {
      grupo.clientesOnline.add(clienteKey);
      ruaStat.clientesOnline.add(clienteKey);
    } else if (reg.connectionHealth === 'desconectado') {
      const cronico = pontoEstaOfflineCronico(
        reg.ultimoLogin,
        reg.ultimoAccounting,
        maxOfflineHoras,
        agoraMs
      );
      if (cronico) {
        grupo.offlineAntigosIgnorados += 1;
        ruaStat.offlineAntigosIgnorados += 1;
        continue;
      }

      grupo.pontoIds.push(reg.pontoId);
      if (!grupo.clientesOfflineCandidatos.has(clienteKey) && reg.nome) {
        grupo.clientesOfflineCandidatos.set(clienteKey, reg.nome);
      }
      if (reg.clienteId) grupo.clienteIdsOffline.add(reg.clienteId);

      ruaStat.pontoIds.push(reg.pontoId);
      if (!ruaStat.clientesOfflineCandidatos.has(clienteKey) && reg.nome) {
        ruaStat.clientesOfflineCandidatos.set(clienteKey, reg.nome);
      }
      if (reg.clienteId) ruaStat.clienteIdsOffline.add(reg.clienteId);
    }
  }

  const extrairClientesOffline = (
    candidatos: Map<string, string>,
    onlineSet: Set<string>
  ): { totalOfflineUnicos: number; nomes: string[] } => {
    const nomes: string[] = [];
    let totalOfflineUnicos = 0;
    for (const [cKey, nome] of candidatos.entries()) {
      if (onlineSet.has(cKey)) continue;
      totalOfflineUnicos += 1;
      if (nomes.length < 30 && nome) {
        nomes.push(nome);
      }
    }
    return { totalOfflineUnicos, nomes };
  };

  const alertas: ISPFYMassOutageAlert[] = [];

  for (const g of grupos.values()) {
    const totalBairroUnicos = g.clientesUnicos.size;
    const {
      totalOfflineUnicos: desconectadosBairro,
      nomes: nomesOfflineBairro,
    } = extrairClientesOffline(g.clientesOfflineCandidatos, g.clientesOnline);

    const ratioBairro =
      totalBairroUnicos > 0 ? desconectadosBairro / totalBairroUnicos : 0;
    const percentualBairro =
      totalBairroUnicos > 0 ? Math.round(ratioBairro * 1000) / 10 : 0;

    const ruasDetalhadas = Array.from(g.ruas.values())
      .map((r) => {
        const totalRuaUnicos = r.clientesUnicos.size;
        const { totalOfflineUnicos: offRua, nomes: nomesRua } =
          extrairClientesOffline(r.clientesOfflineCandidatos, r.clientesOnline);
        const ratioRua = totalRuaUnicos > 0 ? offRua / totalRuaUnicos : 0;
        const pctRua =
          totalRuaUnicos > 0 ? Math.round(ratioRua * 1000) / 10 : 0;
        const atingiuMetadeOuMais =
          r.ruaKey !== CHAVE_RUA_VAZIA &&
          totalRuaUnicos >= minStreetOffline &&
          offRua >= minStreetOffline &&
          ratioRua >= minStreetRatio;
        return {
          ruaKey: r.ruaKey,
          ruaLabel: r.ruaLabel,
          desconectados: offRua,
          totalAtivos: totalRuaUnicos,
          totalClientesUnicos: totalRuaUnicos,
          clientesOfflineUnicos: offRua,
          percentualOffline: pctRua,
          atingiuMetadeOuMais,
          pontoIds: r.pontoIds,
          clienteIdsOffline: Array.from(r.clienteIdsOffline),
          clientesNomes: nomesRua,
          offlineAntigosIgnorados: r.offlineAntigosIgnorados,
        };
      })
      .filter((r) => r.desconectados > 0)
      .sort(
        (a, b) =>
          Number(b.atingiuMetadeOuMais) - Number(a.atingiuMetadeOuMais) ||
          b.percentualOffline - a.percentualOffline ||
          b.desconectados - a.desconectados
      );

    const ruasAfetadasResumo = ruasDetalhadas.slice(0, 6).map((r) => ({
      ruaKey: r.ruaKey,
      ruaLabel: r.ruaLabel,
      desconectados: r.desconectados,
      totalAtivos: r.totalAtivos,
      totalClientesUnicos: r.totalClientesUnicos,
      clientesOfflineUnicos: r.clientesOfflineUnicos,
      percentualOffline: r.percentualOffline,
      atingiuMetadeOuMais: r.atingiuMetadeOuMais,
      clienteIdsOffline: r.clienteIdsOffline,
      offlineAntigosIgnorados: r.offlineAntigosIgnorados,
    }));

    const ruasCriticas = ruasDetalhadas.filter((r) => r.atingiuMetadeOuMais);
    const bairroEmQuedaGeral =
      desconectadosBairro >= minOffline &&
      (ratioBairro >= minRatio || desconectadosBairro >= 15);

    if (
      ruasCriticas.length === 1 &&
      (!bairroEmQuedaGeral ||
        ruasCriticas[0].desconectados / Math.max(1, desconectadosBairro) >= 0.6)
    ) {
      const r = ruasCriticas[0];
      alertas.push({
        incidentKey: sanitizeOutageIncidentKey(`rua__${g.bairroKey}__${r.ruaKey}`),
        tipoAlerta: 'rua_e_bairro',
        bairroKey: g.bairroKey,
        bairroLabel: g.bairroLabel,
        totalAtivosNoBairro: totalBairroUnicos,
        desconectadosNoBairro: desconectadosBairro,
        desconectados: desconectadosBairro,
        percentualOffline: percentualBairro,
        totalClientesUnicos: totalBairroUnicos,
        offlineAntigosIgnorados:
          r.offlineAntigosIgnorados || g.offlineAntigosIgnorados,
        ruaPrincipal: {
          ruaKey: r.ruaKey,
          ruaLabel: r.ruaLabel,
          desconectados: r.desconectados,
          totalAtivos: r.totalAtivos,
          totalClientesUnicos: r.totalClientesUnicos,
          clientesOfflineUnicos: r.clientesOfflineUnicos,
          percentualOffline: r.percentualOffline,
          atingiuMetadeOuMais: true,
          clienteIdsOffline: r.clienteIdsOffline,
          offlineAntigosIgnorados: r.offlineAntigosIgnorados,
        },
        ruasAfetadas: ruasAfetadasResumo,
        pontoIds: r.pontoIds,
        clienteIdsOffline: r.clienteIdsOffline,
        clientesNomes: r.clientesNomes,
      });
      continue;
    }

    if (ruasCriticas.length === 2 && !bairroEmQuedaGeral) {
      for (const r of ruasCriticas) {
        alertas.push({
          incidentKey: sanitizeOutageIncidentKey(`rua__${g.bairroKey}__${r.ruaKey}`),
          tipoAlerta: 'rua_e_bairro',
          bairroKey: g.bairroKey,
          bairroLabel: g.bairroLabel,
          totalAtivosNoBairro: totalBairroUnicos,
          desconectadosNoBairro: desconectadosBairro,
          desconectados: desconectadosBairro,
          percentualOffline: percentualBairro,
          totalClientesUnicos: totalBairroUnicos,
          offlineAntigosIgnorados: r.offlineAntigosIgnorados,
          ruaPrincipal: {
            ruaKey: r.ruaKey,
            ruaLabel: r.ruaLabel,
            desconectados: r.desconectados,
            totalAtivos: r.totalAtivos,
            totalClientesUnicos: r.totalClientesUnicos,
            clientesOfflineUnicos: r.clientesOfflineUnicos,
            percentualOffline: r.percentualOffline,
            atingiuMetadeOuMais: true,
            clienteIdsOffline: r.clienteIdsOffline,
            offlineAntigosIgnorados: r.offlineAntigosIgnorados,
          },
          ruasAfetadas: ruasAfetadasResumo,
          pontoIds: r.pontoIds,
          clienteIdsOffline: r.clienteIdsOffline,
          clientesNomes: r.clientesNomes,
        });
      }
      continue;
    }

    if (bairroEmQuedaGeral || ruasCriticas.length >= 3) {
      alertas.push({
        incidentKey: sanitizeOutageIncidentKey(`bairro__${g.bairroKey}`),
        tipoAlerta: 'bairro',
        bairroKey: g.bairroKey,
        bairroLabel: g.bairroLabel,
        totalAtivosNoBairro: totalBairroUnicos,
        desconectadosNoBairro: desconectadosBairro,
        desconectados: desconectadosBairro,
        percentualOffline: percentualBairro,
        totalClientesUnicos: totalBairroUnicos,
        offlineAntigosIgnorados: g.offlineAntigosIgnorados,
        ruaPrincipal: ruasAfetadasResumo[0] || null,
        ruasAfetadas: ruasAfetadasResumo,
        pontoIds: g.pontoIds,
        clienteIdsOffline: Array.from(g.clienteIdsOffline),
        clientesNomes: nomesOfflineBairro,
      });
    }
  }

  return alertas.sort(
    (a, b) =>
      (b.ruaPrincipal?.percentualOffline ?? b.percentualOffline) -
        (a.ruaPrincipal?.percentualOffline ?? a.percentualOffline) ||
      b.desconectados - a.desconectados
  );
}

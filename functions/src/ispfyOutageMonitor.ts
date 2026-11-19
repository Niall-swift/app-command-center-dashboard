import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import { getIspfyConfig, getWhapiConfig } from "./config/env";
import { IspfyBackendService } from "./ispfyBackendService";
import { WhapiService } from "./whapiService";
import { verifyAuth } from "./config/auth";
import { sendZapiLocation } from "./zapiSuite";

if (admin.apps.length === 0) {
  admin.initializeApp();
}

export const EQUIPE_AVL_GROUP_ID = "120363040961050323-group";
export const EQUIPE_AVL_GROUP_NAME = "EQUIPE AVL";
export const OUTAGE_PERSISTENCE_MS = 5 * 60 * 1000; // 5 minutos contínuos
export const OUTAGE_RESEND_COOLDOWN_MS = 30 * 60 * 1000; // 30 min entre alertas do mesmo episódio

export interface OutageDetectionConfig {
  minClientesOfflineRua: number;
  minPercentualRua: number;
  minClientesOfflineBairro: number;
  minPercentualBairro: number;
  ignorarOfflineAntigoHoras: number;
  confirmarAoVivoAntesEnviar: boolean;
  minChecagensConsecutivas: number;
}

export const DEFAULT_OUTAGE_CONFIG: OutageDetectionConfig = {
  minClientesOfflineRua: 4,
  minPercentualRua: 50,
  minClientesOfflineBairro: 6,
  minPercentualBairro: 35,
  ignorarOfflineAntigoHoras: 72,
  confirmarAoVivoAntesEnviar: true,
  minChecagensConsecutivas: 4,
};

const CHAVE_BAIRRO_VAZIO = "__SEM_BAIRRO__";
const CHAVE_RUA_VAZIA = "__SEM_ENDERECO__";
const ROTULO_BAIRRO_VAZIO = "Sem Bairro Informado";
const ROTULO_RUA_VAZIA = "Sem Endereço Informado";

const MAPA_PREFIXOS_LOGRADOURO: Record<string, string> = {
  R: "RUA",
  RUA: "RUA",
  AV: "AVENIDA",
  AVDA: "AVENIDA",
  AVENIDA: "AVENIDA",
  EST: "ESTRADA",
  ESTR: "ESTRADA",
  ESTRADA: "ESTRADA",
  TV: "TRAVESSA",
  TRAV: "TRAVESSA",
  TRAVESSA: "TRAVESSA",
  AL: "ALAMEDA",
  ALAMEDA: "ALAMEDA",
  PCA: "PRACA",
  PRACA: "PRACA",
  ROD: "RODOVIA",
  RODOVIA: "RODOVIA",
  LOT: "LOTEAMENTO",
  LOTEAMENTO: "LOTEAMENTO",
  COND: "CONDOMINIO",
  CONDOMINIO: "CONDOMINIO",
  SERV: "SERVIDAO",
  SERVIDAO: "SERVIDAO",
  BEC: "BECO",
  BECO: "BECO",
  CAM: "CAMINHO",
  CAMINHO: "CAMINHO",
  SIT: "SITIO",
  SITIO: "SITIO",
  FAZ: "FAZENDA",
  FAZENDA: "FAZENDA",
};

export interface OutageStreetItemPayload {
  ruaKey: string;
  ruaLabel: string;
  desconectados: number;
  totalAtivos: number;
  percentualOffline: number;
  atingiuMetadeOuMais: boolean;
  totalClientesUnicos?: number;
  clientesOfflineUnicos?: number;
  clienteIdsOffline?: string[];
  offlineAntigosIgnorados?: number;
}

export interface OutageCtoSummary {
  ctoId: string;
  ctoLabel: string;
  desconectados: number;
  totalNaCto: number;
  latitude?: number | null;
  longitude?: number | null;
}

export interface ObservedMassOutagePayload {
  incidentKey: string;
  tipoAlerta: "rua_e_bairro" | "bairro";
  bairroKey: string;
  bairroLabel: string;
  totalAtivosNoBairro: number;
  desconectadosNoBairro: number;
  desconectados: number;
  percentualOffline: number;
  ruaPrincipal?: OutageStreetItemPayload | null;
  ctoPrincipal?: OutageCtoSummary | null;
  ruasAfetadas: OutageStreetItemPayload[];
  pontoIds: string[];
  clienteIdsOffline?: string[];
  clientesNomes: string[];
  totalClientesUnicos?: number;
  offlineAntigosIgnorados?: number;
}

export interface BackendOutageEvaluationResult {
  alerts: ObservedMassOutagePayload[];
  globalAnomalyDetected: boolean;
  globalActivePoints: number;
  globalOnlinePoints: number;
  skippedChronicOfflineCount: number;
  configUsed: OutageDetectionConfig;
}

function normalizarTextoSemAcento(valor?: string | null): string {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function normalizarChaveBairro(bruto?: string | null): string {
  const limpo = normalizarTextoSemAcento(bruto)
    .replace(/^[-.,;:/\\\s]+|[-.,;:/\\\s]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!limpo || limpo === "NAO INFORMADO" || limpo === "N/I" || limpo === "-") {
    return CHAVE_BAIRRO_VAZIO;
  }
  return limpo;
}

function normalizarChaveRua(bruto?: string | null): string {
  const limpo = normalizarTextoSemAcento(bruto)
    .replace(/[.,;]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!limpo || limpo === "NAO INFORMADO" || limpo === "N/I" || limpo === "-") {
    return CHAVE_RUA_VAZIA;
  }

  const palavras = limpo.split(" ");
  const prefixoPadronizado = MAPA_PREFIXOS_LOGRADOURO[palavras[0]];
  if (prefixoPadronizado && palavras.length > 1) {
    palavras[0] = prefixoPadronizado;
  }
  return palavras.join(" ");
}

function sanitizeIncidentKey(raw: string): string {
  const cleaned = String(raw || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  return (cleaned || "regiao").slice(0, 120);
}

function escolherMelhorGrafia(variantes: Map<string, number>, fallback: string): string {
  let melhor = fallback;
  let maiorScore = -1;

  variantes.forEach((contagem, raw) => {
    const limpo = raw.replace(/\s+/g, " ").trim();
    if (!limpo) return;
    const temAcento = /[^\u0000-\u007f]/.test(limpo) ? 1 : 0;
    const ehMisto = /[a-z]/.test(limpo) && /[A-Z]/.test(limpo) ? 1 : 0;
    const score = contagem * 10 + temAcento * 3 + ehMisto * 2;
    if (score > maiorScore) {
      maiorScore = score;
      melhor = limpo;
    }
  });

  return melhor;
}

function isPointBlockedOrInactive(params: {
  contratoAtivo?: string | null;
  pontoAtivo?: string | null;
  statusContrato?: string | null;
  poolSobreposta?: string | null;
  isOnline: boolean;
}): "ok" | "desconectado" | "bloqueado" | "inativo" {
  const contratoAtivo = String(params.contratoAtivo ?? "s").trim().toLowerCase();
  const pontoAtivo = String(params.pontoAtivo ?? "s").trim().toLowerCase();
  const statusContrato = String(params.statusContrato ?? "").trim().toLowerCase();
  const pool = String(params.poolSobreposta ?? "").trim().toLowerCase();

  const ehContratoInativo =
    contratoAtivo === "n" ||
    contratoAtivo === "0" ||
    contratoAtivo === "false" ||
    pontoAtivo === "n" ||
    statusContrato === "cancelado" ||
    statusContrato === "encerrado" ||
    statusContrato === "inativo" ||
    statusContrato === "suspenso";

  if (ehContratoInativo) return "inativo";

  if (statusContrato === "bloqueado" || pool === "bloqueado") {
    return "bloqueado";
  }

  return params.isOnline ? "ok" : "desconectado";
}

async function fetchAllAtomicOrPaginated(
  ispfy: IspfyBackendService,
  path: string,
  params: Record<string, any> = {}
): Promise<Record<string, any>[]> {
  try {
    return await ispfy.fetchObject<Record<string, any>>(
      path,
      { ...params, limit: -1, pagination: "FALSE" },
      45000
    );
  } catch (err) {
    console.warn(`[OutageMonitor] Fallback paginado em ${path}:`, err);
    return ispfy.fetchAllObject<Record<string, any>>(path, params, 500, 60);
  }
}

function parseOutageConfig(settingsData: Record<string, unknown>): OutageDetectionConfig {
  const raw = (settingsData?.outageConfig || {}) as Partial<OutageDetectionConfig>;
  const clamp = (val: unknown, fallback: number, min: number, max: number) => {
    const n = Number(val);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  };

  return {
    minClientesOfflineRua: clamp(raw.minClientesOfflineRua, DEFAULT_OUTAGE_CONFIG.minClientesOfflineRua, 2, 100),
    minPercentualRua: clamp(raw.minPercentualRua, DEFAULT_OUTAGE_CONFIG.minPercentualRua, 10, 100),
    minClientesOfflineBairro: clamp(raw.minClientesOfflineBairro, DEFAULT_OUTAGE_CONFIG.minClientesOfflineBairro, 2, 500),
    minPercentualBairro: clamp(raw.minPercentualBairro, DEFAULT_OUTAGE_CONFIG.minPercentualBairro, 10, 100),
    ignorarOfflineAntigoHoras: clamp(raw.ignorarOfflineAntigoHoras, DEFAULT_OUTAGE_CONFIG.ignorarOfflineAntigoHoras, 0, 720),
    confirmarAoVivoAntesEnviar: raw.confirmarAoVivoAntesEnviar !== false,
    minChecagensConsecutivas: clamp(raw.minChecagensConsecutivas, DEFAULT_OUTAGE_CONFIG.minChecagensConsecutivas, 1, 20),
  };
}

/** Interpreta datas do ISPFY sem timezone como horário de Brasília (-03:00). */
function parseIspfyTimestampMs(raw?: unknown): number | null {
  const texto = String(raw || "").trim();
  if (!texto || texto === "-" || texto === "0000-00-00 00:00:00" || texto === "0000-00-00") {
    return null;
  }

  const matchBr = texto.match(
    /^(\d{2})\/(\d{2})\/(\d{4})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/
  );
  if (matchBr) {
    const [, dd, mm, yyyy, hh = "00", mi = "00", ss = "00"] = matchBr;
    const ms = Date.parse(`${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}-03:00`);
    return Number.isFinite(ms) ? ms : null;
  }

  const matchIsoNoTz = texto.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/
  );
  if (matchIsoNoTz) {
    const [, yyyy, mm, dd, hh = "00", mi = "00", ss = "00"] = matchIsoNoTz;
    const ms = Date.parse(`${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}-03:00`);
    return Number.isFinite(ms) ? ms : null;
  }

  const fallback = Date.parse(texto);
  return Number.isFinite(fallback) ? fallback : null;
}

function pontoEstaOfflineCronico(
  ultimoLogin: unknown,
  ultimoAccounting: unknown,
  maxHoras: number,
  referenciaMs: number
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

async function verifyIncidentClientsLive(params: {
  ispfy: IspfyBackendService;
  alerta: ObservedMassOutagePayload;
  cfg: OutageDetectionConfig;
  nowMs: number;
}): Promise<{
  approved: boolean;
  verifiedLiveOfflineCount: number;
  checkedCount: number;
  reason: string | null;
}> {
  const { ispfy, alerta, cfg, nowMs } = params;
  const clienteIds = Array.from(
    new Set((alerta.clienteIdsOffline || []).map((id) => String(id || "").trim()).filter(Boolean))
  );

  if (clienteIds.length === 0) {
    return {
      approved: false,
      verifiedLiveOfflineCount: 0,
      checkedCount: 0,
      reason: "Sem clienteId para confirmação ao vivo no concentrador",
    };
  }

  const sampleIds = clienteIds.slice(0, 15);
  const incidentPontoSet = new Set((alerta.pontoIds || []).map((id) => String(id)));

  let verifiedLiveOfflineCount = 0;
  let checkedSuccess = 0;

  const batchSize = 5;
  for (let i = 0; i < sampleIds.length; i += batchSize) {
    const batch = sampleIds.slice(i, i + batchSize);
    const settled = await Promise.allSettled(
      batch.map((cid) => ispfy.consultarStatusPontos(cid))
    );

    for (const res of settled) {
      if (res.status !== "fulfilled") continue;
      checkedSuccess += 1;
      const pontos = Array.isArray(res.value) ? res.value : [];
      if (pontos.length === 0) continue;

      const relevantPontos = pontos.filter((p) =>
        incidentPontoSet.has(String(p?.id_ponto || ""))
      );
      const targetPontos = relevantPontos.length > 0 ? relevantPontos : pontos;

      const hasOnlinePoint = targetPontos.some(
        (p) => String(p?.conexao_status || "").toLowerCase() === "online"
      );
      if (hasOnlinePoint) continue;

      const hasRealFreshOffline = targetPontos.some((p) => {
        const isBlocked =
          String(p?.bloqueado || "") === "1" ||
          String(p?.status_acesso || "").toLowerCase() === "bloqueado";
        if (isBlocked) return false;
        const isCronico = pontoEstaOfflineCronico(
          p?.ultimo_login,
          undefined,
          cfg.ignorarOfflineAntigoHoras,
          nowMs
        );
        return !isCronico;
      });

      if (hasRealFreshOffline) {
        verifiedLiveOfflineCount += 1;
      }
    }
  }

  if (checkedSuccess === 0) {
    return {
      approved: false,
      verifiedLiveOfflineCount: 0,
      checkedCount: sampleIds.length,
      reason: "Falha ao consultar /ponto/status ao vivo no ISPFY",
    };
  }

  const isRua = alerta.tipoAlerta === "rua_e_bairro" && Boolean(alerta.ruaPrincipal);
  const minRequiredAbs = isRua
    ? Math.max(2, cfg.minClientesOfflineRua)
    : Math.max(2, cfg.minClientesOfflineBairro);
  const minRequiredRatio = (isRua ? cfg.minPercentualRua : cfg.minPercentualBairro) / 100;
  const totalDenominator = isRua
    ? Math.max(1, Number(alerta.ruaPrincipal?.totalAtivos || 0))
    : Math.max(1, Number(alerta.totalAtivosNoBairro || 0));

  const projectedOffline =
    clienteIds.length <= sampleIds.length
      ? verifiedLiveOfflineCount
      : Math.round((verifiedLiveOfflineCount / checkedSuccess) * clienteIds.length);
  const projectedRatio = projectedOffline / totalDenominator;

  if (verifiedLiveOfflineCount < minRequiredAbs) {
    return {
      approved: false,
      verifiedLiveOfflineCount,
      checkedCount: checkedSuccess,
      reason: `Ao vivo: apenas ${verifiedLiveOfflineCount} cliente(s) offline confirmado(s) (mín. ${minRequiredAbs})`,
    };
  }

  if (projectedRatio < minRequiredRatio && !(!isRua && projectedOffline >= 15)) {
    const pctAtual = Math.round(projectedRatio * 1000) / 10;
    return {
      approved: false,
      verifiedLiveOfflineCount,
      checkedCount: checkedSuccess,
      reason: `Ao vivo: percentual caiu para ${pctAtual}% (${projectedOffline}/${totalDenominator})`,
    };
  }

  return {
    approved: true,
    verifiedLiveOfflineCount,
    checkedCount: checkedSuccess,
    reason: null,
  };
}

/**
 * Avalia clientes, contratos, pontos e sessões online no ISPFY aplicando filtros anti-falso-positivo:
 * disjuntor global (< 10% online), deduplicação por cliente único, exclusão de offline crônico (> 72h)
 * e limites mínimos configuráveis por rua e bairro.
 */
export async function evaluateIspfyMassOutagesBackend(
  configInput?: Partial<OutageDetectionConfig>
): Promise<BackendOutageEvaluationResult> {
  const cfg: OutageDetectionConfig = {
    ...DEFAULT_OUTAGE_CONFIG,
    ...(configInput || {}),
  };

  const { host, token } = getIspfyConfig();
  const ispfy = new IspfyBackendService(host, token);
  const agoraMs = Date.now();

  const [allClientes, allContratos, allPontos, onlineSessoes, allCtos] = await Promise.all([
    fetchAllAtomicOrPaginated(ispfy, "/cliente", { sort: "id:ASC" }),
    fetchAllAtomicOrPaginated(ispfy, "/cliente/contrato", { sort: "id:ASC" }),
    fetchAllAtomicOrPaginated(ispfy, "/cliente/contrato/ponto", { sort: "id:ASC" }),
    fetchAllAtomicOrPaginated(ispfy, "/cliente/contrato/ponto/sessoes", {
      filter: "status:EQ:online",
    }),
    fetchAllAtomicOrPaginated(ispfy, "/geofiber/cto", { sort: "id:ASC" }).catch(() => []),
  ]);

  const ctoById = new Map<string, Record<string, any>>();
  for (const cto of allCtos) {
    if (cto?.id != null) ctoById.set(String(cto.id), cto);
  }

  const pontoToCtoId = new Map<string, string>();
  const ctoTotalActiveCount = new Map<string, number>();

  const clientById = new Map<string, Record<string, any>>();
  for (const c of allClientes) {
    if (c?.id) clientById.set(String(c.id), c);
  }

  const contratoById = new Map<string, Record<string, any>>();
  for (const ct of allContratos) {
    if (ct?.id) contratoById.set(String(ct.id), ct);
  }

  const onlinePontoSet = new Set<string>();
  for (const s of onlineSessoes) {
    const ptId = String(s?.id_ponto || "").trim();
    if (ptId && String(s?.status || "").toLowerCase() === "online") {
      onlinePontoSet.add(ptId);
    }
  }

  const variantesBairro = new Map<string, Map<string, number>>();
  const variantesRua = new Map<string, Map<string, number>>();

  const registrarVariante = (
    mapa: Map<string, Map<string, number>>,
    chave: string,
    valorBruto: string
  ) => {
    const contagem = mapa.get(chave) || new Map<string, number>();
    contagem.set(valorBruto, (contagem.get(valorBruto) || 0) + 1);
    mapa.set(chave, contagem);
  };

  let globalActivePoints = 0;
  let globalOnlinePoints = 0;

  const preparados = allPontos.map((pt) => {
    const pontoId = String(pt?.id || "");
    const contratoId = String(pt?.id_contrato || "");
    const contrato = contratoById.get(contratoId);
    const clienteId = String(contrato?.id_cliente || pt?.id_cliente || "");
    const cliente = clientById.get(clienteId);

    const bairroBruto = String(
      pt?.bairro || cliente?.endereco_cobranca_bairro || cliente?.bairro || ""
    ).trim();
    const ruaBruta = String(
      pt?.endereco || cliente?.endereco_cobranca_rua || cliente?.endereco || ""
    ).trim();

    const bairroKey = normalizarChaveBairro(bairroBruto);
    const ruaKey = normalizarChaveRua(ruaBruta);

    if (bairroKey !== CHAVE_BAIRRO_VAZIO && bairroBruto) {
      registrarVariante(variantesBairro, bairroKey, bairroBruto);
    }
    const chaveRuaComposta = `${bairroKey}::${ruaKey}`;
    if (ruaKey !== CHAVE_RUA_VAZIA && ruaBruta) {
      registrarVariante(variantesRua, chaveRuaComposta, ruaBruta);
    }

    const isOnline =
      onlinePontoSet.has(pontoId) ||
      String(pt?.sessao_conexao_status || "").toLowerCase() === "online";

    const health = isPointBlockedOrInactive({
      contratoAtivo: contrato?.contrato_ativo,
      pontoAtivo: pt?.ativo,
      statusContrato: contrato?.status_contrato,
      poolSobreposta: pt?.ipv4_wan_pool_sobreposta,
      isOnline,
    });

    if (health !== "inativo") {
      globalActivePoints += 1;
      if (health === "ok") {
        globalOnlinePoints += 1;
      }
      const rawCtoId = String(
        pt?.id_cto || pt?.id_caixa || pt?.caixa_id || pt?.geofiber_id_cto || ""
      ).trim();
      if (rawCtoId && rawCtoId !== "0") {
        pontoToCtoId.set(pontoId, rawCtoId);
        ctoTotalActiveCount.set(rawCtoId, (ctoTotalActiveCount.get(rawCtoId) || 0) + 1);
      }
    }

    const nome = String(
      cliente?.nome_razao ||
        cliente?.razao_social ||
        cliente?.nome ||
        `Cliente #${clienteId || pontoId}`
    ).trim();

    const ultimoLogin = pt?.sessao_ultimo_login ?? pt?.ultimo_login ?? null;
    const ultimoAccounting = pt?.ultimo_accounting ?? null;

    return {
      pontoId,
      contratoId,
      clienteId,
      nome,
      bairroKey,
      ruaKey,
      health,
      ultimoLogin,
      ultimoAccounting,
    };
  });

  // Disjuntor global: se toda a API ISPFY/RADIUS aparentar estar offline (< 10% online), aborta alertas
  const globalAnomalyDetected =
    globalActivePoints >= 20 &&
    (globalOnlinePoints === 0 ||
      globalOnlinePoints < Math.max(5, Math.floor(globalActivePoints * 0.1)));

  if (globalAnomalyDetected) {
    console.warn("[OutageMonitor] Disjuntor global acionado — leitura ISPFY/RADIUS inconsistente.", {
      globalActivePoints,
      globalOnlinePoints,
    });
    return {
      alerts: [],
      globalAnomalyDetected: true,
      globalActivePoints,
      globalOnlinePoints,
      skippedChronicOfflineCount: 0,
      configUsed: cfg,
    };
  }

  const rotuloBairro = new Map<string, string>();
  variantesBairro.forEach((v, k) => rotuloBairro.set(k, escolherMelhorGrafia(v, ROTULO_BAIRRO_VAZIO)));
  const rotuloRua = new Map<string, string>();
  variantesRua.forEach((v, k) => rotuloRua.set(k, escolherMelhorGrafia(v, ROTULO_RUA_VAZIA)));

  interface RuaAcc {
    ruaKey: string;
    ruaLabel: string;
    clientesUnicos: Set<string>;
    clientesOnline: Set<string>;
    clientesOfflineCandidatos: Map<string, string>;
    clienteIdsOffline: Set<string>;
    pontoIds: string[];
    offlineAntigosIgnorados: number;
  }

  interface BairroAcc {
    bairroKey: string;
    bairroLabel: string;
    clientesUnicos: Set<string>;
    clientesOnline: Set<string>;
    clientesOfflineCandidatos: Map<string, string>;
    clienteIdsOffline: Set<string>;
    pontoIds: string[];
    offlineAntigosIgnorados: number;
    ruas: Map<string, RuaAcc>;
  }

  const grupos = new Map<string, BairroAcc>();
  let skippedChronicOfflineCount = 0;

  for (const reg of preparados) {
    if (reg.health === "inativo") continue;
    if (reg.bairroKey === CHAVE_BAIRRO_VAZIO) continue;

    const clienteKey = reg.clienteId
      ? `cli:${reg.clienteId}`
      : reg.contratoId
      ? `ct:${reg.contratoId}`
      : `pt:${reg.pontoId}`;

    const bLabel = rotuloBairro.get(reg.bairroKey) || ROTULO_BAIRRO_VAZIO;
    const rLabel =
      reg.ruaKey === CHAVE_RUA_VAZIA
        ? ROTULO_RUA_VAZIA
        : rotuloRua.get(`${reg.bairroKey}::${reg.ruaKey}`) || ROTULO_RUA_VAZIA;

    let grupo = grupos.get(reg.bairroKey);
    if (!grupo) {
      grupo = {
        bairroKey: reg.bairroKey,
        bairroLabel: bLabel,
        clientesUnicos: new Set<string>(),
        clientesOnline: new Set<string>(),
        clientesOfflineCandidatos: new Map<string, string>(),
        clienteIdsOffline: new Set<string>(),
        pontoIds: [],
        offlineAntigosIgnorados: 0,
        ruas: new Map(),
      };
      grupos.set(reg.bairroKey, grupo);
    }

    grupo.clientesUnicos.add(clienteKey);
    let ruaStat = grupo.ruas.get(reg.ruaKey);
    if (!ruaStat) {
      ruaStat = {
        ruaKey: reg.ruaKey,
        ruaLabel: rLabel,
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

    if (reg.health === "ok") {
      grupo.clientesOnline.add(clienteKey);
      ruaStat.clientesOnline.add(clienteKey);
    } else if (reg.health === "desconectado") {
      const isCronico = pontoEstaOfflineCronico(
        reg.ultimoLogin,
        reg.ultimoAccounting,
        cfg.ignorarOfflineAntigoHoras,
        agoraMs
      );
      if (isCronico) {
        skippedChronicOfflineCount += 1;
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

  const minStreetOffline = Math.max(2, cfg.minClientesOfflineRua);
  const minStreetRatio = Math.max(0.1, Math.min(1, cfg.minPercentualRua / 100));
  const minOffline = Math.max(2, cfg.minClientesOfflineBairro);
  const minRatio = Math.max(0.1, Math.min(1, cfg.minPercentualBairro / 100));

  const alertas: ObservedMassOutagePayload[] = [];

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
        const pctRua = totalRuaUnicos > 0 ? Math.round(ratioRua * 1000) / 10 : 0;
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

    const ruasResumo: OutageStreetItemPayload[] = ruasDetalhadas.slice(0, 6).map((r) => ({
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
        incidentKey: sanitizeIncidentKey(`rua__${g.bairroKey}__${r.ruaKey}`),
        tipoAlerta: "rua_e_bairro",
        bairroKey: g.bairroKey,
        bairroLabel: g.bairroLabel,
        totalAtivosNoBairro: totalBairroUnicos,
        desconectadosNoBairro: desconectadosBairro,
        desconectados: desconectadosBairro,
        percentualOffline: percentualBairro,
        totalClientesUnicos: totalBairroUnicos,
        offlineAntigosIgnorados: r.offlineAntigosIgnorados || g.offlineAntigosIgnorados,
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
        ruasAfetadas: ruasResumo,
        pontoIds: r.pontoIds,
        clienteIdsOffline: r.clienteIdsOffline,
        clientesNomes: r.clientesNomes,
      });
      continue;
    }

    if (ruasCriticas.length === 2 && !bairroEmQuedaGeral) {
      for (const r of ruasCriticas) {
        alertas.push({
          incidentKey: sanitizeIncidentKey(`rua__${g.bairroKey}__${r.ruaKey}`),
          tipoAlerta: "rua_e_bairro",
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
          ruasAfetadas: ruasResumo,
          pontoIds: r.pontoIds,
          clienteIdsOffline: r.clienteIdsOffline,
          clientesNomes: r.clientesNomes,
        });
      }
      continue;
    }

    if (bairroEmQuedaGeral || ruasCriticas.length >= 3) {
      alertas.push({
        incidentKey: sanitizeIncidentKey(`bairro__${g.bairroKey}`),
        tipoAlerta: "bairro",
        bairroKey: g.bairroKey,
        bairroLabel: g.bairroLabel,
        totalAtivosNoBairro: totalBairroUnicos,
        desconectadosNoBairro: desconectadosBairro,
        desconectados: desconectadosBairro,
        percentualOffline: percentualBairro,
        totalClientesUnicos: totalBairroUnicos,
        offlineAntigosIgnorados: g.offlineAntigosIgnorados,
        ruaPrincipal: ruasResumo[0] || null,
        ruasAfetadas: ruasResumo,
        pontoIds: g.pontoIds,
        clienteIdsOffline: Array.from(g.clienteIdsOffline),
        clientesNomes: nomesOfflineBairro,
      });
    }
  }

  // Correlaciona CTO principal afetada (causa raiz FTTH) quando >= 2 pontos offline compartilham a mesma CTO
  for (const alerta of alertas) {
    const ctoOffCounts = new Map<string, number>();
    for (const pid of alerta.pontoIds || []) {
      const cid = pontoToCtoId.get(pid);
      if (cid) {
        ctoOffCounts.set(cid, (ctoOffCounts.get(cid) || 0) + 1);
      }
    }
    let bestCtoId = "";
    let bestCount = 0;
    ctoOffCounts.forEach((cnt, cid) => {
      if (cnt > bestCount) {
        bestCount = cnt;
        bestCtoId = cid;
      }
    });
    if (bestCtoId && bestCount >= 2) {
      const ctoRow = ctoById.get(bestCtoId);
      const rawLat = ctoRow?.latitude ?? ctoRow?.lat ?? null;
      const rawLng = ctoRow?.longitude ?? ctoRow?.lng ?? null;
      const latNum = rawLat != null ? Number(String(rawLat).replace(",", ".")) : NaN;
      const lngNum = rawLng != null ? Number(String(rawLng).replace(",", ".")) : NaN;
      alerta.ctoPrincipal = {
        ctoId: bestCtoId,
        ctoLabel: String(
          ctoRow?.nome || ctoRow?.descricao || ctoRow?.codigo || `CTO #${bestCtoId}`
        ).trim(),
        desconectados: bestCount,
        totalNaCto: ctoTotalActiveCount.get(bestCtoId) || bestCount,
        latitude: Number.isFinite(latNum) && latNum !== 0 ? latNum : null,
        longitude: Number.isFinite(lngNum) && lngNum !== 0 ? lngNum : null,
      };
    }
  }

  return {
    alerts: alertas,
    globalAnomalyDetected: false,
    globalActivePoints,
    globalOnlinePoints,
    skippedChronicOfflineCount,
    configUsed: cfg,
  };
}

function buildEquipeAvlWhatsappMessage(params: {
  alerta: ObservedMassOutagePayload;
  elapsedMinutes: number;
  manualTrigger?: boolean;
  verifiedLiveOfflineCount?: number | null;
}): string {
  const { alerta, elapsedMinutes, manualTrigger, verifiedLiveOfflineCount } = params;
  const rp = alerta.ruaPrincipal;
  const cto = alerta.ctoPrincipal;
  const offBairro = alerta.desconectadosNoBairro ?? alerta.desconectados;
  const totalBairro = alerta.totalAtivosNoBairro;
  const pctBairro = alerta.percentualOffline;

  const cabecalho = manualTrigger
    ? "🚨 *ALERTA NOC AVL — POSSÍVEL ROMPIMENTO*"
    : `🚨 *ALERTA AUTOMÁTICO NOC — POSSÍVEL ROMPIMENTO (> ${Math.max(5, elapsedMinutes)} MIN)*`;

  const linhasRua = rp
    ? `🛣️ *Rua:* ${rp.ruaLabel}\n` +
      `👥 *Na Rua:* *${rp.desconectados}* offline de *${rp.totalAtivos}* clientes (*${rp.percentualOffline}%*)\n`
    : "";

  const linhasCto = cto
    ? `📦 *CTO Principal Afetada:* *${cto.ctoLabel}* (${cto.desconectados}/${cto.totalNaCto} off)` +
      (cto.latitude && cto.longitude
        ? `\n🗺️ *Mapa da CTO:* https://maps.google.com/?q=${cto.latitude},${cto.longitude}\n`
        : "\n")
    : "";

  const linhasConfirmacao =
    typeof verifiedLiveOfflineCount === "number" && verifiedLiveOfflineCount > 0
      ? `✅ *Verificados ao vivo (concentrador):* *${verifiedLiveOfflineCount}* cliente(s) offline reais\n`
      : "";

  const outrasRuasTxt =
    alerta.ruasAfetadas && alerta.ruasAfetadas.length > 0
      ? alerta.ruasAfetadas
          .slice(0, 5)
          .map(
            (r) =>
              `• ${r.ruaLabel}: *${r.desconectados}* off de ${r.totalAtivos} (*${r.percentualOffline}%*)`
          )
          .join("\n")
      : "";

  const nomesTxt =
    alerta.clientesNomes && alerta.clientesNomes.length > 0
      ? `\n📋 *Exemplos de clientes offline:*\n${alerta.clientesNomes
          .slice(0, 6)
          .map((n) => `• ${n}`)
          .join("\n")}`
      : "";

  return (
    `${cabecalho}\n\n` +
    `📍 *Bairro:* ${alerta.bairroLabel}\n` +
    linhasRua +
    linhasCto +
    `🏘️ *No Bairro (${alerta.bairroLabel}):* *${offBairro}* offline de *${totalBairro}* clientes (*${pctBairro}%*)\n` +
    linhasConfirmacao +
    (!manualTrigger ? `⏱️ *Tempo contínuo da queda:* ${elapsedMinutes} min\n` : "") +
    (outrasRuasTxt ? `\n📌 *Detalhamento por rua no bairro:*\n${outrasRuasTxt}` : "") +
    nomesTxt +
    "\n\n⚠️ _Metade ou mais dos clientes dessa rua/trecho estão desconectados após checagem ao vivo. Verificar CTO, splitter ou cabo óptico no local!_"
  );
}

/**
 * Sincroniza incidentes de rua/bairro no Firestore (`outage_watch`),
 * exige persistência >= 5 min + checagens consecutivas + confirmação ao vivo no /ponto/status
 * antes de enviar WhatsApp único para o grupo EQUIPE AVL.
 */
export async function syncOutageWatchesAndDispatch(params: {
  observedAlerts: ObservedMassOutagePayload[];
  fullScan: boolean;
  source: string;
  forceSendIncidentKey?: string;
  settingsDataOverride?: Record<string, unknown>;
}): Promise<{
  activeCount: number;
  resolvedCount: number;
  whatsappSentKeys: string[];
  blockedDispatchCount: number;
  autoEnabled: boolean;
}> {
  const db = admin.firestore();
  const now = Date.now();

  const settingsData =
    params.settingsDataOverride ??
    ((await db.collection("settings").doc("ispfy_automations").get()).data() || {});
  const autoEnabled = settingsData?.massOutageWhatsappEnabled !== false;
  const cfg = parseOutageConfig(settingsData);
  const targetGroupId =
    String(settingsData?.massOutageGroupId || EQUIPE_AVL_GROUP_ID).trim() ||
    EQUIPE_AVL_GROUP_ID;
  const targetGroupName =
    String(settingsData?.massOutageGroupName || EQUIPE_AVL_GROUP_NAME).trim() ||
    EQUIPE_AVL_GROUP_NAME;

  const activeWatchSnap = await db
    .collection("outage_watch")
    .where("active", "==", true)
    .get();

  const previouslyActiveByBairro = new Map<
    string,
    { earliestFirstDetectedAtMs: number; recentSentAtMs: number | null }
  >();
  activeWatchSnap.docs.forEach((d) => {
    const data = d.data();
    const bKey = String(data?.bairroKey || "");
    if (!bKey) return;
    const prev = previouslyActiveByBairro.get(bKey);
    const firstMs = Number(data?.firstDetectedAtMs || now);
    const sentMs = data?.whatsappSentAtMs ? Number(data.whatsappSentAtMs) : null;
    if (!prev) {
      previouslyActiveByBairro.set(bKey, {
        earliestFirstDetectedAtMs: firstMs,
        recentSentAtMs: sentMs,
      });
    } else {
      prev.earliestFirstDetectedAtMs = Math.min(prev.earliestFirstDetectedAtMs, firstMs);
      if (sentMs && (!prev.recentSentAtMs || sentMs > prev.recentSentAtMs)) {
        prev.recentSentAtMs = sentMs;
      }
    }
  });

  const observedMap = new Map<string, ObservedMassOutagePayload>();
  for (const a of params.observedAlerts) {
    if (!a || !a.incidentKey) continue;
    const safeKey = sanitizeIncidentKey(a.incidentKey);
    observedMap.set(safeKey, { ...a, incidentKey: safeKey });
  }

  // 1. Atualiza ou cria os documentos ativos observados (com contador de checagens consecutivas)
  const activeIncidentRecords: Array<{
    alert: ObservedMassOutagePayload;
    firstDetectedAtMs: number;
    whatsappSentAtMs: number | null;
    consecutiveHits: number;
  }> = [];

  for (const [safeKey, alert] of observedMap.entries()) {
    const docRef = db.collection("outage_watch").doc(safeKey);
    const rp = alert.ruaPrincipal;
    const offBairro = alert.desconectadosNoBairro ?? alert.desconectados;

    const txRes = await db.runTransaction(async (tx) => {
      const snap = await tx.get(docRef);
      const existing = snap.exists ? snap.data() || {} : null;
      const isAlreadyActive = existing?.active === true;

      let firstDetectedAtMs = isAlreadyActive
        ? Number(existing?.firstDetectedAtMs || now)
        : now;

      let consecutiveHits = 1;
      let lastCountedHitAtMs = now;
      if (isAlreadyActive) {
        const prevHits = Number(existing?.consecutiveHits || 1);
        const prevHitMs = Number(existing?.lastCountedHitAtMs || existing?.lastSeenAtMs || 0);
        if (now - prevHitMs >= 45 * 1000) {
          consecutiveHits = prevHits + 1;
          lastCountedHitAtMs = now;
        } else {
          consecutiveHits = prevHits;
          lastCountedHitAtMs = prevHitMs || now;
        }
      }

      let inheritedSentAtMs: number | null = isAlreadyActive
        ? existing?.whatsappSentAtMs
          ? Number(existing.whatsappSentAtMs)
          : null
        : existing?.whatsappSentAtMs &&
            now - Number(existing.whatsappSentAtMs) < OUTAGE_RESEND_COOLDOWN_MS
          ? Number(existing.whatsappSentAtMs)
          : null;

      // Se uma rua crítica acabou de promover para alerta consolidado do mesmo bairro, herda início contínuo
      if (!isAlreadyActive && alert.tipoAlerta === "bairro") {
        const promo = previouslyActiveByBairro.get(alert.bairroKey);
        if (promo) {
          firstDetectedAtMs = Math.min(firstDetectedAtMs, promo.earliestFirstDetectedAtMs);
          if (promo.recentSentAtMs && now - promo.recentSentAtMs < OUTAGE_RESEND_COOLDOWN_MS) {
            inheritedSentAtMs = promo.recentSentAtMs;
          }
        }
      }

      tx.set(
        docRef,
        {
          incidentKey: safeKey,
          active: true,
          tipoAlerta: alert.tipoAlerta || "rua_e_bairro",
          bairroKey: alert.bairroKey,
          bairroLabel: alert.bairroLabel,
          ruaKey: rp?.ruaKey || null,
          ruaLabel: rp?.ruaLabel || null,
          ctoPrincipal: alert.ctoPrincipal || null,
          totalRua: Number(rp?.totalAtivos || 0),
          offlineRua: Number(rp?.desconectados || 0),
          percentualRua: Number(rp?.percentualOffline || 0),
          totalBairro: Number(alert.totalAtivosNoBairro || 0),
          offlineBairro: Number(offBairro || 0),
          percentualBairro: Number(alert.percentualOffline || 0),
          offlineAntigosIgnorados: Number(alert.offlineAntigosIgnorados || 0),
          totalClientesUnicosRua: Number(rp?.totalClientesUnicos || rp?.totalAtivos || 0),
          offlineClientesUnicosRua: Number(rp?.clientesOfflineUnicos || rp?.desconectados || 0),
          totalClientesUnicosBairro: Number(alert.totalClientesUnicos || alert.totalAtivosNoBairro || 0),
          offlineClientesUnicosBairro: Number(offBairro || 0),
          consecutiveHits,
          lastCountedHitAtMs,
          ruasAfetadas: (alert.ruasAfetadas || []).slice(0, 6),
          clientesSample: (alert.clientesNomes || []).slice(0, 10),
          firstDetectedAtMs,
          lastSeenAtMs: now,
          lastSource: params.source,
          resolvedAtMs: null,
          ...(isAlreadyActive
            ? {}
            : {
                whatsappSentAtMs: inheritedSentAtMs,
                whatsappSendingLockUntilMs: null,
                whatsappError: null,
                whatsappBlockedReason: null,
                verifiedLiveOfflineCount: null,
              }),
        },
        { merge: true }
      );

      return {
        firstDetectedAtMs,
        whatsappSentAtMs: inheritedSentAtMs,
        consecutiveHits,
      };
    });

    activeIncidentRecords.push({
      alert,
      firstDetectedAtMs: txRes.firstDetectedAtMs,
      whatsappSentAtMs: txRes.whatsappSentAtMs,
      consecutiveHits: txRes.consecutiveHits,
    });
  }

  // 2. Marca como normalizados incidentes que saíram da zona de rompimento (apenas em fullScan)
  let resolvedCount = 0;
  if (params.fullScan) {
    const batch = db.batch();
    for (const docSnap of activeWatchSnap.docs) {
      if (!observedMap.has(docSnap.id)) {
        batch.set(
          docSnap.ref,
          {
            active: false,
            resolvedAtMs: now,
            whatsappSendingLockUntilMs: null,
            resolvedBySource: params.source,
          },
          { merge: true }
        );
        resolvedCount += 1;
      }
    }
    if (resolvedCount > 0) {
      await batch.commit();
    }
  }

  // 3. Verifica persistência >= 5 min + checagens consecutivas + confirmação ao vivo no /ponto/status
  const whatsappSentKeys: string[] = [];
  let blockedDispatchCount = 0;
  let cachedIspfy: IspfyBackendService | null = null;

  const getIspfyClient = () => {
    if (!cachedIspfy) {
      const { host, token } = getIspfyConfig();
      cachedIspfy = new IspfyBackendService(host, token);
    }
    return cachedIspfy;
  };

  for (const item of activeIncidentRecords) {
    const safeKey = item.alert.incidentKey;
    const isManualForce = params.forceSendIncidentKey === safeKey;
    const elapsedMs = now - item.firstDetectedAtMs;

    if (
      !isManualForce &&
      (!autoEnabled ||
        elapsedMs < OUTAGE_PERSISTENCE_MS ||
        item.consecutiveHits < cfg.minChecagensConsecutivas)
    ) {
      continue;
    }

    const docRef = db.collection("outage_watch").doc(safeKey);
    const claim = await db.runTransaction(async (tx) => {
      const snap = await tx.get(docRef);
      const data = snap.data() || {};
      if (data.active !== true) return { shouldSend: false };
      if (!isManualForce && data.whatsappSentAtMs) return { shouldSend: false };
      if (!isManualForce && Number(data.whatsappSendingLockUntilMs || 0) > now) {
        return { shouldSend: false };
      }

      tx.set(
        docRef,
        {
          whatsappSendingLockUntilMs: now + 60 * 1000,
        },
        { merge: true }
      );
      return {
        shouldSend: true,
        firstDetectedAtMs: Number(data.firstDetectedAtMs || now),
      };
    });

    if (!claim.shouldSend) continue;

    let verifiedLiveOfflineCount: number | null = null;
    if (!isManualForce && cfg.confirmarAoVivoAntesEnviar) {
      try {
        const liveCheck = await verifyIncidentClientsLive({
          ispfy: getIspfyClient(),
          alerta: item.alert,
          cfg,
          nowMs: Date.now(),
        });
        verifiedLiveOfflineCount = liveCheck.verifiedLiveOfflineCount;

        if (!liveCheck.approved) {
          blockedDispatchCount += 1;
          console.warn(`[OutageMonitor] Envio bloqueado na dupla checagem ao vivo (${safeKey}): ${liveCheck.reason}`);
          await docRef.set(
            {
              verifiedLiveOfflineCount: liveCheck.verifiedLiveOfflineCount,
              whatsappBlockedReason: liveCheck.reason,
              whatsappSendingLockUntilMs: Date.now() + 90 * 1000,
            },
            { merge: true }
          );
          continue;
        }
      } catch (verifyErr: unknown) {
        blockedDispatchCount += 1;
        const verifyMsg =
          verifyErr instanceof Error ? verifyErr.message : "Erro na verificação ao vivo";
        await docRef.set(
          {
            whatsappBlockedReason: `Erro ao confirmar ao vivo: ${verifyMsg}`,
            whatsappSendingLockUntilMs: Date.now() + 90 * 1000,
          },
          { merge: true }
        );
        continue;
      }
    }

    const elapsedMinutes = Math.max(
      1,
      Math.round((now - (claim.firstDetectedAtMs || now)) / 60000)
    );

    try {
      const { apiKey, baseUrl } = getWhapiConfig();
      const whapi = new WhapiService(apiKey, baseUrl);
      const message = buildEquipeAvlWhatsappMessage({
        alerta: item.alert,
        elapsedMinutes,
        manualTrigger: isManualForce && elapsedMs < OUTAGE_PERSISTENCE_MS,
        verifiedLiveOfflineCount,
      });

      const sendRes = await whapi.sendCustomMessage(targetGroupId, message);
      if (sendRes.sent) {
        if (item.alert.ctoPrincipal?.latitude && item.alert.ctoPrincipal?.longitude) {
          await sendZapiLocation({
            phone: targetGroupId,
            latitude: item.alert.ctoPrincipal.latitude,
            longitude: item.alert.ctoPrincipal.longitude,
            title: `CTO Afetada: ${item.alert.ctoPrincipal.ctoLabel}`,
            address: `${item.alert.ruaPrincipal?.ruaLabel || item.alert.bairroLabel} — ${item.alert.bairroLabel}`,
          }).catch(() => undefined);
        }
        await docRef.set(
          {
            whatsappSentAtMs: Date.now(),
            whatsappGroupId: targetGroupId,
            whatsappGroupName: targetGroupName,
            whatsappMessageId: sendRes.id || null,
            verifiedLiveOfflineCount,
            whatsappBlockedReason: null,
            whatsappError: null,
            whatsappSendingLockUntilMs: null,
          },
          { merge: true }
        );
        whatsappSentKeys.push(safeKey);
      } else {
        await docRef.set(
          {
            whatsappError: sendRes.error || "Falha ao enviar para o grupo EQUIPE AVL",
            whatsappSendingLockUntilMs: Date.now() + 45 * 1000,
          },
          { merge: true }
        );
      }
    } catch (err: unknown) {
      const msgErr = err instanceof Error ? err.message : "Erro ao enviar alerta WhatsApp";
      await docRef.set(
        {
          whatsappError: msgErr,
          whatsappSendingLockUntilMs: Date.now() + 45 * 1000,
        },
        { merge: true }
      );
    }
  }

  return {
    activeCount: activeIncidentRecords.length,
    resolvedCount,
    whatsappSentKeys,
    blockedDispatchCount,
    autoEnabled,
  };
}

async function executeBackendOutageCheck(source: string) {
  const startedAt = Date.now();
  const db = admin.firestore();
  const settingsRef = db.collection("settings").doc("ispfy_automations");

  try {
    const settingsSnap = await settingsRef.get();
    const settingsData = settingsSnap.data() || {};
    const cfg = parseOutageConfig(settingsData);

    const evaluation = await evaluateIspfyMassOutagesBackend(cfg);

    if (evaluation.globalAnomalyDetected) {
      const finishedAt = Date.now();
      await settingsRef.set(
        {
          outageMonitorHeartbeat: {
            lastRunAtMs: finishedAt,
            durationMs: finishedAt - startedAt,
            status: "anomaly_guard",
            globalAnomalyDetected: true,
            globalActivePoints: evaluation.globalActivePoints,
            globalOnlinePoints: evaluation.globalOnlinePoints,
            skippedChronicOfflineCount: evaluation.skippedChronicOfflineCount,
            activeCount: 0,
            resolvedCount: 0,
            whatsappSentCount: 0,
            blockedDispatchCount: 0,
            source,
            lastError: `Disjuntor global ativado (${evaluation.globalOnlinePoints}/${evaluation.globalActivePoints} pontos online)`,
          },
        },
        { merge: true }
      );
      return {
        activeCount: 0,
        resolvedCount: 0,
        whatsappSentKeys: [] as string[],
        blockedDispatchCount: 0,
        autoEnabled: settingsData?.massOutageWhatsappEnabled !== false,
        globalAnomalyDetected: true,
      };
    }

    const result = await syncOutageWatchesAndDispatch({
      observedAlerts: evaluation.alerts,
      fullScan: true,
      source,
      settingsDataOverride: settingsData,
    });
    const finishedAt = Date.now();
    await settingsRef.set(
      {
        outageMonitorHeartbeat: {
          lastRunAtMs: finishedAt,
          durationMs: finishedAt - startedAt,
          status: "ok",
          globalAnomalyDetected: false,
          globalActivePoints: evaluation.globalActivePoints,
          globalOnlinePoints: evaluation.globalOnlinePoints,
          skippedChronicOfflineCount: evaluation.skippedChronicOfflineCount,
          activeCount: result.activeCount,
          resolvedCount: result.resolvedCount,
          whatsappSentCount: result.whatsappSentKeys.length,
          blockedDispatchCount: result.blockedDispatchCount,
          source,
          lastError: null,
        },
      },
      { merge: true }
    );
    return result;
  } catch (err: unknown) {
    const finishedAt = Date.now();
    const msg = err instanceof Error ? err.message : "Erro ao verificar ISPFY";
    await settingsRef
      .set(
        {
          outageMonitorHeartbeat: {
            lastRunAtMs: finishedAt,
            durationMs: finishedAt - startedAt,
            status: "error",
            activeCount: 0,
            resolvedCount: 0,
            whatsappSentCount: 0,
            blockedDispatchCount: 0,
            source,
            lastError: msg,
          },
        },
        { merge: true }
      )
      .catch(() => undefined);
    throw err;
  }
}

/**
 * Cron 24/7 no Cloud Functions (a cada 1 minuto): verifica quedas de >= 50% por rua + bairro
 * de forma totalmente autônoma mesmo com o painel fechado e dispara WhatsApp para EQUIPE AVL após 5 minutos contínuos.
 */
export const monitorIspfyMassOutagesCron = functions
  .runWith({ memory: "512MB", timeoutSeconds: 120 })
  .pubsub.schedule("every 1 minutes")
  .timeZone("America/Sao_Paulo")
  .onRun(async () => {
    try {
      const result = await executeBackendOutageCheck("cloud_cron_1min");
      console.log("[monitorIspfyMassOutagesCron] Resultado 24h:", result);
    } catch (err) {
      console.error("[monitorIspfyMassOutagesCron] Erro no monitoramento 24/7:", err);
    }
  });

/**
 * Callable acionado pelo painel ou teste manual:
 * - action === "run_backend_now": força uma execução completa na Cloud Function (mesma rotina do cron 24h)
 * - padrão: sincroniza o snapshot observado ou envia alerta manual imediato.
 */
export const syncMassOutageWatch = functions
  .runWith({ memory: "512MB", timeoutSeconds: 120 })
  .https.onCall(async (data, context) => {
    verifyAuth(context);

    if (data?.action === "run_backend_now") {
      const result = await executeBackendOutageCheck("manual_cloud_trigger");
      return {
        success: true,
        ...result,
      };
    }

    const observedAlerts = Array.isArray(data?.observedAlerts)
      ? (data.observedAlerts as ObservedMassOutagePayload[])
      : [];
    const fullScan = data?.fullScan !== false;
    const forceSendIncidentKey = data?.forceSendIncidentKey
      ? sanitizeIncidentKey(String(data.forceSendIncidentKey))
      : undefined;

    const result = await syncOutageWatchesAndDispatch({
      observedAlerts,
      fullScan,
      source: data?.source ? String(data.source) : "frontend_poll",
      forceSendIncidentKey,
    });

    return {
      success: true,
      ...result,
    };
  });


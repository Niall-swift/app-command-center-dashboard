import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import * as crypto from "crypto";
import axios from "axios";
import { getSmartOltConfig, getWhapiConfig } from "./config/env";
import { WhatsAppService } from "./services/whatsappService";

// ============================================================================
// SmartOLT Types (aligned with official OpenAPI spec: smartolt.com/openapi.json)
// ============================================================================

interface RawSmartOltOlt {
  id: string;
  name: string;
  olt_hardware_version?: string;
  ip?: string;
  telnet_port?: string;
  snmp_port?: string;
  olt_type?: string;
}

interface RawSmartOltUptime {
  olt_id: string;
  olt_name?: string;
  uptime?: string;
  env_temp?: string;
  voltage?: number | null;
  voltage_read_at?: string | null;
  power_state?: string | null;
}

interface RawSmartOltOnuStatus {
  unique_external_id: string;
  sn?: string;
  olt_id?: string;
  board?: string;
  port?: string;
  onu?: string;
  zone_id?: string;
  name?: string;
  address?: string;
  contact?: string;
  odb_id?: string | null;
  status?: string;
  last_status_change?: string;
  status_observed_at?: string;
}

interface RawSmartOltOnuSignal {
  unique_external_id: string;
  sn?: string;
  olt_id?: string;
  board?: string;
  port?: string;
  onu?: string;
  name?: string;
  signal_1310?: string;
  signal_1490?: string;
  signal?: string;
}

interface RawSmartOltUnconfigured {
  pon_type?: string;
  board?: string;
  port?: string;
  pon_description?: string;
  onu?: string;
  sn?: string;
  onu_type_name?: string;
  onu_type_id?: string;
  olt_id?: string;
  is_disabled?: number;
  first_seen_at?: string;
  last_seen_at?: string;
}

export type NormalizedOnuStatus =
  | "online"
  | "los"
  | "power_fail"
  | "offline"
  | "login"
  | "unknown";

export interface EnrichedSmartOltOnu {
  id: string;
  unique_external_id: string;
  sn: string;
  name: string;
  address: string;
  contact: string;
  olt_id: string;
  olt_name: string;
  board: string;
  pon_port: string;
  onu_id: string;
  onuid: string;
  zone_id: string;
  odb_id: string | null;
  status: NormalizedOnuStatus;
  raw_status: string;
  last_status_change: string;
  signal_quality: string;
  signal_1310: string;
  signal_1490: string;
  rx_power_numeric: number | null;
  olt_rx_power_numeric: number | null;
}

// ============================================================================
// In-Memory TTL Cache + In-Flight Deduplication (protects 1,000 req/h budget)
// ============================================================================

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  fetchedAt: number;
}

const memCache = new Map<string, CacheEntry<unknown>>();
const inFlight = new Map<string, Promise<unknown>>();

const TTL_OLTS_MS = 30 * 60 * 1000; // 30 min (SmartOLT warns never to poll get_olts)
const TTL_OLT_HEALTH_MS = 3 * 60 * 1000; // 3 min
const TTL_ONU_STATUSES_MS = 2 * 60 * 1000; // 2 min
const TTL_ONU_SIGNALS_MS = 5 * 60 * 1000; // 5 min
const TTL_UNCONFIGURED_MS = 60 * 1000; // 1 min
const TTL_GPS_MS = 30 * 60 * 1000; // 30 min (strict SmartOLT rate limit)

function getCached<T>(key: string): T | null {
  const entry = memCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    memCache.delete(key);
    return null;
  }
  return entry.data as T;
}

async function fetchSmartOltJson<T>(
  path: string,
  options?: {
    cacheKey?: string;
    ttlMs?: number;
    forceFresh?: boolean;
    params?: Record<string, string | number>;
    timeoutMs?: number;
  }
): Promise<T> {
  const cacheKey = options?.cacheKey;
  if (cacheKey && !options?.forceFresh) {
    const hit = getCached<T>(cacheKey);
    if (hit !== null) return hit;
    const pending = inFlight.get(cacheKey);
    if (pending) return pending as Promise<T>;
  }

  const { baseUrl, token } = getSmartOltConfig();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${baseUrl}${normalizedPath}`;

  const promise = (async () => {
    const res = await axios.get<T>(url, {
      headers: {
        "X-Token": token,
        Accept: "application/json",
      },
      params: options?.params,
      timeout: options?.timeoutMs ?? 25000,
    });

    if (cacheKey && options?.ttlMs) {
      memCache.set(cacheKey, {
        data: res.data,
        expiresAt: Date.now() + options.ttlMs,
        fetchedAt: Date.now(),
      });
    }
    return res.data;
  })();

  if (cacheKey) {
    inFlight.set(cacheKey, promise);
    promise.finally(() => inFlight.delete(cacheKey)).catch(() => undefined);
  }

  return promise;
}

// ============================================================================
// Normalization & Matching Helpers
// ============================================================================

function normalizeText(value: unknown): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeOnuStatus(raw?: string): NormalizedOnuStatus {
  const s = String(raw || "").trim().toLowerCase();
  if (s === "online") return "online";
  if (s === "los") return "los";
  if (s.includes("power")) return "power_fail";
  if (s === "offline") return "offline";
  if (s.includes("log")) return "login";
  return "unknown";
}

function parseDbm(raw?: string | number | null): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  const cleaned = String(raw).trim();
  if (!cleaned || cleaned === "-" || cleaned.toLowerCase() === "n/a") return null;
  const match = cleaned.match(/-?\d+(?:[.,]\d+)?/);
  if (!match) return null;
  const num = Number(match[0].replace(",", "."));
  return Number.isFinite(num) ? num : null;
}

function pickPrimaryRx(sig1310?: string, sig1490?: string): number | null {
  // SmartOLT signal_1310 = OLT RX (upstream), signal_1490 = ONU RX (downstream, may be "-")
  const v1490 = parseDbm(sig1490);
  const v1310 = parseDbm(sig1310);
  return v1490 ?? v1310;
}

function getEffectiveRxDbm(onu: EnrichedSmartOltOnu): number | null {
  return onu.rx_power_numeric ?? onu.olt_rx_power_numeric;
}

async function getOltsList(forceFresh = false): Promise<RawSmartOltOlt[]> {
  const res = await fetchSmartOltJson<{ status?: boolean; response?: RawSmartOltOlt[] }>(
    "/system/get_olts",
    { cacheKey: "olts", ttlMs: TTL_OLTS_MS, forceFresh }
  );
  return Array.isArray(res?.response) ? res.response : [];
}

async function getOltsHealth(forceFresh = false): Promise<RawSmartOltUptime[]> {
  const res = await fetchSmartOltJson<{ status?: boolean; response?: RawSmartOltUptime[] }>(
    "/olt/get_olts_uptime_and_env_temperature",
    { cacheKey: "olt_health", ttlMs: TTL_OLT_HEALTH_MS, forceFresh }
  );
  return Array.isArray(res?.response) ? res.response : [];
}

async function getAllStatuses(forceFresh = false): Promise<RawSmartOltOnuStatus[]> {
  const res = await fetchSmartOltJson<{ status?: boolean; response?: RawSmartOltOnuStatus[] }>(
    "/onu/get_onus_statuses",
    { cacheKey: "onu_statuses", ttlMs: TTL_ONU_STATUSES_MS, forceFresh, timeoutMs: 35000 }
  );
  return Array.isArray(res?.response) ? res.response : [];
}

async function getAllSignals(forceFresh = false): Promise<RawSmartOltOnuSignal[]> {
  const res = await fetchSmartOltJson<{ status?: boolean; response?: RawSmartOltOnuSignal[] }>(
    "/onu/get_onus_signals",
    { cacheKey: "onu_signals", ttlMs: TTL_ONU_SIGNALS_MS, forceFresh, timeoutMs: 35000 }
  );
  return Array.isArray(res?.response) ? res.response : [];
}

async function getUnconfiguredList(forceFresh = false): Promise<RawSmartOltUnconfigured[]> {
  const res = await fetchSmartOltJson<{ status?: boolean; response?: RawSmartOltUnconfigured[] }>(
    "/onu/unconfigured_onus",
    { cacheKey: "unconfigured", ttlMs: TTL_UNCONFIGURED_MS, forceFresh }
  );
  return Array.isArray(res?.response) ? res.response : [];
}

async function getEnrichedOnusIndex(forceFresh = false): Promise<{
  olts: RawSmartOltOlt[];
  oltMap: Map<string, RawSmartOltOlt>;
  onus: EnrichedSmartOltOnu[];
}> {
  const [olts, statuses, signals] = await Promise.all([
    getOltsList(false).catch(() => []),
    getAllStatuses(forceFresh),
    getAllSignals(false).catch(() => []),
  ]);

  const oltMap = new Map<string, RawSmartOltOlt>();
  for (const olt of olts) {
    oltMap.set(String(olt.id), olt);
  }

  const signalMap = new Map<string, RawSmartOltOnuSignal>();
  for (const sig of signals) {
    if (sig.unique_external_id) {
      signalMap.set(String(sig.unique_external_id), sig);
    }
  }

  const onus: EnrichedSmartOltOnu[] = statuses.map((st) => {
    const extId = String(st.unique_external_id || st.sn || "");
    const sig = signalMap.get(extId);
    const olt = oltMap.get(String(st.olt_id || ""));
    const sig1310 = String(sig?.signal_1310 || "-");
    const sig1490 = String(sig?.signal_1490 || "-");

    return {
      id: extId,
      unique_external_id: extId,
      sn: String(st.sn || ""),
      name: String(st.name || ""),
      address: String(st.address || ""),
      contact: String(st.contact || ""),
      olt_id: String(st.olt_id || ""),
      olt_name: olt?.name || (st.olt_id ? `OLT #${st.olt_id}` : "OLT"),
      board: String(st.board || ""),
      pon_port: String(st.port || ""),
      onu_id: String(st.onu || ""),
      onuid: extId,
      zone_id: String(st.zone_id || ""),
      odb_id: st.odb_id ? String(st.odb_id) : null,
      status: normalizeOnuStatus(st.status),
      raw_status: String(st.status || "Unknown"),
      last_status_change: String(st.last_status_change || ""),
      signal_quality: String(sig?.signal || ""),
      signal_1310: sig1310,
      signal_1490: sig1490,
      rx_power_numeric: pickPrimaryRx(sig1310, sig1490),
      olt_rx_power_numeric: parseDbm(sig1310),
    };
  });

  return { olts, oltMap, onus };
}

const RETIRED_ONU_REGEX =
  /\b(recolha|troca\s+de\s+equipamento|equipamento\s+trocado|cancelad[oa]|retirad[oa]|desativad[oa]|antig[oa])\b/i;

const NAME_STOPWORDS = new Set([
  "da",
  "de",
  "do",
  "dos",
  "das",
  "del",
  "e",
  "com",
  "ltda",
  "me",
  "eireli",
  "sa",
  "jr",
  "filho",
  "neto",
]);

function compactAlnumDot(value: string): string {
  return normalizeText(value).replace(/[^a-z0-9.]/g, "");
}

function stripTrailingDigits(value: string): string {
  return value.replace(/\d+$/, "");
}

function extractOnuLoginParts(rawOnuName: string): {
  cleaned: string;
  beforeSlash: string;
  compactWithDigits: string;
  compactWithoutDigits: string;
  isRetired: boolean;
} {
  const norm = normalizeText(rawOnuName);
  const isRetired = RETIRED_ONU_REGEX.test(norm);
  // Remove anotações entre parênteses como "( RECOLHA ABERTA )" ou "( TROCA DE EQUIPAMENTO ... )"
  const cleaned = norm.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
  const slashParts = cleaned.split("/").map((p) => p.trim()).filter(Boolean);
  const beforeSlash = slashParts[0] || cleaned;
  // Ex: "samuel.oliveira / 160" -> compactWithDigits = "samuel.oliveira160", compactWithoutDigits = "samuel.oliveira"
  const compactWithDigits =
    slashParts.length >= 2 && /^\d+$/.test(slashParts[1])
      ? compactAlnumDot(`${slashParts[0]}${slashParts[1]}`)
      : compactAlnumDot(beforeSlash);
  const compactWithoutDigits = stripTrailingDigits(compactAlnumDot(beforeSlash));
  return { cleaned, beforeSlash, compactWithDigits, compactWithoutDigits, isRetired };
}

interface ScoreMatchResult {
  score: number;
  reason: "linked_id" | "sn" | "pppoe_exact" | "pppoe_base" | "full_name" | "none";
}

function scoreOnuMatch(
  onu: EnrichedSmartOltOnu,
  params: {
    onuId?: string;
    sn?: string;
    logins: string[];
    fullNames: string[];
    legacyQueries: string[];
  }
): ScoreMatchResult {
  const extLower = onu.unique_external_id.toLowerCase();
  const snLower = onu.sn.toLowerCase();

  if (params.onuId && extLower === params.onuId.toLowerCase()) {
    return { score: 120, reason: "linked_id" };
  }
  if (params.sn && snLower && snLower === params.sn.toLowerCase()) {
    return { score: 115, reason: "sn" };
  }

  const rawName = normalizeText(onu.name);
  if (!rawName && !snLower) return { score: 0, reason: "none" };

  const parts = extractOnuLoginParts(onu.name);
  const nameTokens = new Set(
    parts.cleaned.split(/[\s/|,;_-]+/).filter((t) => t.length >= 2)
  );
  const wordTokens = new Set(
    parts.cleaned.split(/[^a-z0-9]+/).filter((t) => t.length >= 2)
  );

  let bestScore = 0;
  let bestReason: ScoreMatchResult["reason"] = "none";

  const applyCandidate = (score: number, reason: ScoreMatchResult["reason"]) => {
    if (score > bestScore) {
      bestScore = score;
      bestReason = reason;
    }
  };

  // 1. Prioridade máxima: Logins PPPoE exatos vindos do ISPFY (campo `usuario` do ponto)
  const loginCandidates = [
    ...params.logins,
    ...params.legacyQueries.filter((q) => !q.includes(" ") && (q.includes(".") || /\d/.test(q))),
  ];

  for (const rawLogin of loginCandidates) {
    const q = normalizeText(rawLogin);
    if (q.length < 3) continue;

    if (snLower && snLower === q) {
      applyCandidate(115, "sn");
      continue;
    }

    const qCompact = compactAlnumDot(q);
    const qNoDigits = stripTrailingDigits(qCompact);

    // Match EXATO: "joyce.silva160" === "joyce.silva160" ou "samuel.oliveira160" === "samuel.oliveira / 160"
    if (
      parts.beforeSlash === q ||
      parts.cleaned === q ||
      (qCompact.length >= 4 && parts.compactWithDigits === qCompact)
    ) {
      applyCandidate(100, "pppoe_exact");
      continue;
    }

    // Match exato no token PPPoE dentro do nome da ONU
    if (nameTokens.has(q) || (qCompact.length >= 4 && nameTokens.has(qCompact))) {
      applyCandidate(96, "pppoe_exact");
      continue;
    }

    // Match na base do login sem o sufixo numérico (ex: ISPFY "samantha.lopes124" vs OLT "samantha.lopes / 124" ou "samantha.lopes")
    if (
      qNoDigits.length >= 6 &&
      qNoDigits.includes(".") &&
      parts.compactWithoutDigits === qNoDigits
    ) {
      applyCandidate(91, "pppoe_base");
      continue;
    }
  }

  // 2. Fallback por Nome Completo (EXIGE pelo menos 2 palavras distintas — NUNCA casa por 1 primeiro nome isolado!)
  const nameCandidates = [
    ...params.fullNames,
    ...params.legacyQueries.filter((q) => q.trim().includes(" ")),
  ];

  for (const rawFullName of nameCandidates) {
    const q = normalizeText(rawFullName);
    const words = Array.from(
      new Set(
        q
          .split(/[^a-z0-9]+/)
          .filter((w) => w.length >= 3 && !NAME_STOPWORDS.has(w))
      )
    );
    if (words.length < 2) continue;

    const first = words[0];
    const surnames = words.slice(1);

    // Verifica se o primeiro nome bate E pelo menos 1 sobrenome bate como token ou prefixo em nome tipo "samantha.lopes124"
    const hasWord = (w: string) => {
      if (wordTokens.has(w)) return true;
      for (const tok of wordTokens) {
        if (tok.startsWith(w) && tok.length <= w.length + 4 && /^\d*$/.test(tok.slice(w.length))) {
          return true; // ex: token "lopes124" casa com sobrenome "lopes"!
        }
      }
      return false;
    };

    const firstMatches = hasWord(first);
    const matchedSurnames = surnames.filter((s) => hasWord(s));

    if (firstMatches && matchedSurnames.length >= 2) {
      applyCandidate(86, "full_name");
    } else if (firstMatches && matchedSurnames.length === 1) {
      applyCandidate(80, "full_name");
    } else if (words.length >= 3 && matchedSurnames.length >= 2) {
      applyCandidate(76, "full_name");
    }
  }

  if (bestScore === 0) return { score: 0, reason: "none" };

  // Penaliza ONUs marcadas como RECOLHA / TROCA DE EQUIPAMENTO / CANCELADA
  if (parts.isRetired) {
    bestScore -= 22;
  }

  // Desempate inteligente: prefere ONT ativa/online quando o cliente tem histórico de equipamento antigo
  if (onu.status === "online") bestScore += 3;
  else if (onu.status === "los" || onu.status === "power_fail") bestScore += 1;

  return { score: bestScore, reason: bestReason };
}

// ============================================================================
// Firebase Auth Verification Helper (Bearer token from Dashboard)
// ============================================================================

async function verifyBearerAuth(req: functions.https.Request): Promise<admin.auth.DecodedIdToken | null> {
  const authHeader = String(req.headers.authorization || req.headers.Authorization || "");
  if (!authHeader.startsWith("Bearer ")) return null;
  const idToken = authHeader.slice(7).trim();
  if (!idToken) return null;
  try {
    return await admin.auth().verifyIdToken(idToken);
  } catch {
    return null;
  }
}

function setCorsHeaders(res: functions.Response) {
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Authorization, Content-Type, Accept, X-Requested-With"
  );
}

// ============================================================================
// 1. SMARTOLT SECURE PROXY + IN-MEMORY CACHE + CLIENT MATCHING
// ============================================================================

export const smartOltProxy = functions
  .runWith({ memory: "256MB", timeoutSeconds: 60 })
  .https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === "OPTIONS") {
      res.status(200).end();
      return;
    }

    // Requer usuário autenticado no painel AVL (token Firebase Auth)
    const decodedUser = await verifyBearerAuth(req);
    if (!decodedUser) {
      res.status(401).json({
        status: false,
        error: "Autenticação obrigatória para acessar o SmartOLT.",
      });
      return;
    }

    const reqPath = (req.path || "/").replace(/\/+$/, "") || "/";

    try {
      // ------------------------------------------------------------------
      // GET /olts -> Lista das OLTs com saúde (uptime, temperatura, tensão)
      // ------------------------------------------------------------------
      if (req.method === "GET" && (reqPath === "/olts" || reqPath === "/olt-overview")) {
        const forceFresh = req.query.fresh === "1";
        const [olts, healthList, statuses, unconfigured] = await Promise.all([
          getOltsList(forceFresh),
          getOltsHealth(forceFresh).catch(() => []),
          reqPath === "/olt-overview" ? getAllStatuses(forceFresh).catch(() => []) : Promise.resolve([]),
          reqPath === "/olt-overview" ? getUnconfiguredList(forceFresh).catch(() => []) : Promise.resolve([]),
        ]);

        const healthById = new Map<string, RawSmartOltUptime>();
        for (const h of healthList) {
          healthById.set(String(h.olt_id), h);
        }

        const countsByOlt = new Map<
          string,
          { total: number; online: number; los: number; powerFail: number; offline: number }
        >();
        for (const st of statuses) {
          const oid = String(st.olt_id || "");
          const bucket = countsByOlt.get(oid) || {
            total: 0,
            online: 0,
            los: 0,
            powerFail: 0,
            offline: 0,
          };
          bucket.total += 1;
          const norm = normalizeOnuStatus(st.status);
          if (norm === "online") bucket.online += 1;
          else if (norm === "los") bucket.los += 1;
          else if (norm === "power_fail") bucket.powerFail += 1;
          else bucket.offline += 1;
          countsByOlt.set(oid, bucket);
        }

        const enrichedOlts = olts.map((o) => {
          const h = healthById.get(String(o.id));
          const c = countsByOlt.get(String(o.id)) || {
            total: 0,
            online: 0,
            los: 0,
            powerFail: 0,
            offline: 0,
          };
          return {
            id: String(o.id),
            name: o.name,
            ip: o.ip || "",
            telnet_port: o.telnet_port || "",
            snmp_port: o.snmp_port || "",
            hardware_version: o.olt_hardware_version || "",
            olt_type: o.olt_type || "",
            uptime: h?.uptime || "N/A",
            temperature: h?.env_temp || "",
            voltage: h?.voltage ?? null,
            voltage_read_at: h?.voltage_read_at || null,
            power_state: h?.power_state || null,
            onu_counts: c,
          };
        });

        res.status(200).json({
          status: true,
          olts: enrichedOlts,
          unconfigured_count: unconfigured.length,
          unconfigured_onus: unconfigured.slice(0, 30),
        });
        return;
      }

      // ------------------------------------------------------------------
      // GET /find-client-onu -> Encontra ONT de um cliente em <5ms no cache
      // ------------------------------------------------------------------
      if (req.method === "GET" && reqPath === "/find-client-onu") {
        const onuId = String(req.query.onuId || "").trim();
        const sn = String(req.query.sn || "").trim();
        const rawLogins = String(req.query.logins || "");
        const rawFullNames = String(req.query.fullNames || "");
        const rawQueries = String(req.query.queries || "");
        const live = req.query.live === "1";

        const splitList = (raw: string) =>
          raw
            .split("||")
            .map((q) => q.trim())
            .filter((q) => q.length >= 3);

        const logins = splitList(rawLogins);
        const fullNames = splitList(rawFullNames);
        const legacyQueries = splitList(rawQueries);

        if (!onuId && !sn && logins.length === 0 && fullNames.length === 0 && legacyQueries.length === 0) {
          res.status(200).json({ status: true, onu: null, match_reason: "none", candidates: [] });
          return;
        }

        const { onus } = await getEnrichedOnusIndex(false);
        const scored: Array<{
          onu: EnrichedSmartOltOnu;
          score: number;
          reason: ScoreMatchResult["reason"];
        }> = [];

        for (const onu of onus) {
          const m = scoreOnuMatch(onu, { onuId, sn, logins, fullNames, legacyQueries });
          if (m.score >= 70) {
            scored.push({ onu, score: m.score, reason: m.reason });
          }
        }

        scored.sort((a, b) => b.score - a.score);
        const top = scored[0]?.onu ? { ...scored[0].onu } : null;

        // Se solicitado ?live=1 (ou match encontrado), pode atualizar status/sinal direto na OLT
        if (top && live) {
          const [liveStatusRes, liveSignalRes] = await Promise.allSettled([
            fetchSmartOltJson<{
              status?: boolean;
              onu_status?: string;
              last_status_change?: string;
            }>(`/onu/get_onu_status/${encodeURIComponent(top.unique_external_id)}`, {
              timeoutMs: 20000,
            }),
            fetchSmartOltJson<{
              status?: boolean;
              onu_signal?: string;
              onu_signal_1310?: string;
              onu_signal_1490?: string;
              onu_signal_value?: string;
            }>(`/onu/get_onu_signal/${encodeURIComponent(top.unique_external_id)}`, {
              timeoutMs: 20000,
            }),
          ]);

          if (liveStatusRes.status === "fulfilled" && liveStatusRes.value?.status) {
            if (liveStatusRes.value.onu_status) {
              top.raw_status = liveStatusRes.value.onu_status;
              top.status = normalizeOnuStatus(liveStatusRes.value.onu_status);
            }
            if (liveStatusRes.value.last_status_change) {
              top.last_status_change = liveStatusRes.value.last_status_change;
            }
          }
          if (liveSignalRes.status === "fulfilled" && liveSignalRes.value?.status) {
            top.signal_quality = liveSignalRes.value.onu_signal || top.signal_quality;
            top.signal_1310 = liveSignalRes.value.onu_signal_1310 || top.signal_1310;
            top.signal_1490 = liveSignalRes.value.onu_signal_1490 || top.signal_1490;
            top.rx_power_numeric = pickPrimaryRx(top.signal_1310, top.signal_1490);
            top.olt_rx_power_numeric = parseDbm(top.signal_1310);
          }
        }

        res.status(200).json({
          status: true,
          onu: top,
          match_score: scored[0]?.score ?? 0,
          match_reason: scored[0]?.reason ?? "none",
          candidates: scored.slice(0, 6).map((s) => s.onu),
          live_checked: Boolean(top && live),
        });
        return;
      }

      // ------------------------------------------------------------------
      // GET /search-onus?q=...&limit=20 -> Busca manual rápida nas 8.924 ONUs
      // ------------------------------------------------------------------
      if (req.method === "GET" && (reqPath === "/search-onus" || reqPath === "/onus")) {
        const q = normalizeText(req.query.q || req.query.search || "");
        const limit = Math.min(2000, Math.max(1, Number(req.query.limit || 25)));
        const { onus } = await getEnrichedOnusIndex(false);

        let filtered = onus;
        if (q) {
          filtered = onus.filter((o) => {
            const hay = normalizeText(
              `${o.name} ${o.sn} ${o.unique_external_id} ${o.address} ${o.olt_name} ${o.board}/${o.pon_port}`
            );
            return hay.includes(q);
          });
        }

        res.status(200).json({
          status: true,
          total: filtered.length,
          onus: filtered.slice(0, limit),
        });
        return;
      }

      // ------------------------------------------------------------------
      // GET /onu-diagnostics/:externalId -> Diagnóstico profundo da ONT
      // ------------------------------------------------------------------
      if (req.method === "GET" && reqPath.startsWith("/onu-diagnostics/")) {
        const externalId = decodeURIComponent(reqPath.slice("/onu-diagnostics/".length));
        const live = req.query.live !== "0";

        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const fmtDate = (d: Date) =>
          d.toISOString().replace("T", " ").slice(0, 19);

        const [indexRes, liveStatusRes, liveSignalRes, historyRes, speedRes, detailsRes] =
          await Promise.allSettled([
            getEnrichedOnusIndex(false),
            live
              ? fetchSmartOltJson<{
                  status?: boolean;
                  onu_status?: string;
                  last_status_change?: string;
                }>(`/onu/get_onu_status/${encodeURIComponent(externalId)}`, {
                  timeoutMs: 20000,
                })
              : Promise.resolve(null),
            fetchSmartOltJson<{
              status?: boolean;
              onu_signal?: string;
              onu_signal_1310?: string;
              onu_signal_1490?: string;
              onu_signal_value?: string;
            }>(`/onu/get_onu_signal/${encodeURIComponent(externalId)}`, {
              timeoutMs: 20000,
            }),
            fetchSmartOltJson<{
              status?: boolean;
              summary?: {
                online_percent?: number;
                known_seconds?: number;
                interruptions?: number;
                seconds?: {
                  online?: number;
                  los?: number;
                  power_fail?: number;
                  offline?: number;
                };
              };
            }>(`/onu/get_onu_status_history/${encodeURIComponent(externalId)}`, {
              params: { from: fmtDate(sevenDaysAgo), to: fmtDate(now) },
              timeoutMs: 15000,
            }),
            fetchSmartOltJson<{
              status?: boolean;
              upload_speed_profile_name?: string;
              download_speed_profile_name?: string;
            }>(`/onu/get_onu_speed_profiles/${encodeURIComponent(externalId)}`, {
              timeoutMs: 15000,
            }),
            fetchSmartOltJson<{
              status?: boolean;
              onu_details?: Record<string, unknown>;
            }>(`/onu/get_onu_details/${encodeURIComponent(externalId)}`, {
              timeoutMs: 15000,
            }),
          ]);

        const baseOnu =
          indexRes.status === "fulfilled"
            ? indexRes.value.onus.find((o) => o.unique_external_id === externalId) || null
            : null;

        const onu: EnrichedSmartOltOnu = baseOnu
          ? { ...baseOnu }
          : {
              id: externalId,
              unique_external_id: externalId,
              sn: externalId,
              name: externalId,
              address: "",
              contact: "",
              olt_id: "",
              olt_name: "OLT",
              board: "",
              pon_port: "",
              onu_id: "",
              onuid: externalId,
              zone_id: "",
              odb_id: null,
              status: "unknown",
              raw_status: "Unknown",
              last_status_change: "",
              signal_quality: "",
              signal_1310: "-",
              signal_1490: "-",
              rx_power_numeric: null,
              olt_rx_power_numeric: null,
            };

        if (liveStatusRes.status === "fulfilled" && liveStatusRes.value?.status) {
          if (liveStatusRes.value.onu_status) {
            onu.raw_status = liveStatusRes.value.onu_status;
            onu.status = normalizeOnuStatus(liveStatusRes.value.onu_status);
          }
          if (liveStatusRes.value.last_status_change) {
            onu.last_status_change = liveStatusRes.value.last_status_change;
          }
        }

        if (liveSignalRes.status === "fulfilled" && liveSignalRes.value?.status) {
          onu.signal_quality = liveSignalRes.value.onu_signal || onu.signal_quality;
          onu.signal_1310 = liveSignalRes.value.onu_signal_1310 || onu.signal_1310;
          onu.signal_1490 = liveSignalRes.value.onu_signal_1490 || onu.signal_1490;
          onu.rx_power_numeric = pickPrimaryRx(onu.signal_1310, onu.signal_1490);
          onu.olt_rx_power_numeric = parseDbm(onu.signal_1310);
        }

        const detailsObj =
          detailsRes.status === "fulfilled" && detailsRes.value?.onu_details
            ? detailsRes.value.onu_details
            : null;

        res.status(200).json({
          status: true,
          onu,
          details: detailsObj
            ? {
                onu_type_name: String(detailsObj.onu_type_name || ""),
                zone_name: String(detailsObj.zone_name || ""),
                odb_name: String(detailsObj.odb_name || ""),
                mode: String(detailsObj.mode || ""),
                administrative_status: String(detailsObj.administrative_status || ""),
                authorization_date: String(detailsObj.authorization_date || ""),
                catv: String(detailsObj.catv || ""),
              }
            : null,
          speed_profiles:
            speedRes.status === "fulfilled" && speedRes.value?.status
              ? {
                  download: speedRes.value.download_speed_profile_name || "",
                  upload: speedRes.value.upload_speed_profile_name || "",
                }
              : null,
          history_7d:
            historyRes.status === "fulfilled" && historyRes.value?.summary
              ? {
                  online_percent: Number(historyRes.value.summary.online_percent ?? 0),
                  interruptions: Number(historyRes.value.summary.interruptions ?? 0),
                  seconds: {
                    online: Number(historyRes.value.summary.seconds?.online ?? 0),
                    los: Number(historyRes.value.summary.seconds?.los ?? 0),
                    power_fail: Number(historyRes.value.summary.seconds?.power_fail ?? 0),
                    offline: Number(historyRes.value.summary.seconds?.offline ?? 0),
                  },
                }
              : null,
        });
        return;
      }

      // ------------------------------------------------------------------
      // GET /optical-radar -> Varredura em lote (1 chamada) + Saúde das 7 OLTs
      // ------------------------------------------------------------------
      if (req.method === "GET" && reqPath === "/optical-radar") {
        const threshold = Number(req.query.threshold ?? -26);
        const limit = Math.min(300, Math.max(10, Number(req.query.limit ?? 150)));
        const forceFresh = req.query.fresh === "1";

        const [{ olts, onus }, healthList, unconfigured] = await Promise.all([
          getEnrichedOnusIndex(forceFresh),
          getOltsHealth(forceFresh).catch(() => []),
          getUnconfiguredList(forceFresh).catch(() => []),
        ]);

        const summary = {
          total: onus.length,
          online: 0,
          los: 0,
          powerFail: 0,
          offline: 0,
          criticalSignal: 0,
          unconfigured: unconfigured.length,
        };

        const criticalItems: EnrichedSmartOltOnu[] = [];
        const countsByOlt = new Map<
          string,
          { total: number; online: number; los: number; powerFail: number; offline: number }
        >();

        for (const o of onus) {
          const bucket = countsByOlt.get(o.olt_id) || {
            total: 0,
            online: 0,
            los: 0,
            powerFail: 0,
            offline: 0,
          };
          bucket.total += 1;

          const rx = getEffectiveRxDbm(o);
          const isLowSignal = rx !== null && rx <= threshold;

          if (o.status === "online") {
            summary.online += 1;
            bucket.online += 1;
            if (isLowSignal || o.signal_quality.toLowerCase() === "critical") {
              summary.criticalSignal += 1;
              criticalItems.push(o);
            }
          } else if (o.status === "los") {
            summary.los += 1;
            bucket.los += 1;
            criticalItems.push(o);
          } else if (o.status === "power_fail") {
            summary.powerFail += 1;
            bucket.powerFail += 1;
            criticalItems.push(o);
          } else {
            summary.offline += 1;
            bucket.offline += 1;
          }

          countsByOlt.set(o.olt_id, bucket);
        }

        const severityRank = (o: EnrichedSmartOltOnu) => {
          if (o.status === "los") return 0;
          if (o.status === "online") return 1; // sinal crítico em cliente online (preventivo!)
          if (o.status === "power_fail") return 2;
          return 3;
        };

        criticalItems.sort((a, b) => {
          const rankDiff = severityRank(a) - severityRank(b);
          if (rankDiff !== 0) return rankDiff;
          return (getEffectiveRxDbm(a) ?? -99) - (getEffectiveRxDbm(b) ?? -99);
        });

        const healthById = new Map<string, RawSmartOltUptime>(
          healthList.map((h): [string, RawSmartOltUptime] => [String(h.olt_id), h])
        );
        const oltOverview = olts.map((o) => {
          const h = healthById.get(String(o.id));
          return {
            id: String(o.id),
            name: o.name,
            hardware_version: o.olt_hardware_version || "",
            ip: o.ip || "",
            uptime: h?.uptime || "N/A",
            temperature: h?.env_temp || "",
            voltage: h?.voltage ?? null,
            power_state: h?.power_state || null,
            onu_counts: countsByOlt.get(String(o.id)) || {
              total: 0,
              online: 0,
              los: 0,
              powerFail: 0,
              offline: 0,
            },
          };
        });

        const oltNameMap = new Map<string, string>(
          olts.map((o): [string, string] => [String(o.id), o.name])
        );

        res.status(200).json({
          status: true,
          threshold,
          summary,
          olts: oltOverview,
          items: criticalItems.slice(0, limit),
          unconfigured_onus: unconfigured.slice(0, 30).map((u) => ({
            ...u,
            olt_name: oltNameMap.get(String(u.olt_id || "")) || `OLT #${u.olt_id || ""}`,
          })),
        });
        return;
      }

      // ------------------------------------------------------------------
      // GET /unconfigured -> ONUs aguardando autorização
      // ------------------------------------------------------------------
      if (req.method === "GET" && reqPath === "/unconfigured") {
        const [olts, list] = await Promise.all([
          getOltsList(false).catch(() => []),
          getUnconfiguredList(req.query.fresh === "1"),
        ]);
        const oltNameMap = new Map<string, string>(
          olts.map((o): [string, string] => [String(o.id), o.name])
        );
        res.status(200).json({
          status: true,
          response: list.map((u) => ({
            ...u,
            olt_name: oltNameMap.get(String(u.olt_id || "")) || `OLT #${u.olt_id || ""}`,
          })),
        });
        return;
      }

      // ------------------------------------------------------------------
      // GET /onus-gps -> Coordenadas GPS com cache 30 min
      // ------------------------------------------------------------------
      if (req.method === "GET" && reqPath === "/onus-gps") {
        const gpsRes = await fetchSmartOltJson<{ status?: boolean; response?: unknown }>(
          "/onu/get_all_onus_gps_coordinates",
          { cacheKey: "onus_gps", ttlMs: TTL_GPS_MS, timeoutMs: 35000 }
        );
        res.status(200).json({
          status: true,
          data: gpsRes?.response || {},
        });
        return;
      }

      // ------------------------------------------------------------------
      // GET /onu-signal-graph/:externalId/:graphType -> Gráfico PNG de sinal
      // ------------------------------------------------------------------
      if (req.method === "GET" && reqPath.startsWith("/onu-signal-graph/")) {
        const parts = reqPath.slice("/onu-signal-graph/".length).split("/");
        const externalId = decodeURIComponent(parts[0] || "");
        const graphType = ["hourly", "daily", "weekly", "monthly", "yearly"].includes(parts[1] || "")
          ? parts[1]
          : "daily";

        const { baseUrl, token } = getSmartOltConfig();
        const imgRes = await axios.get(
          `${baseUrl}/onu/get_onu_signal_graph/${encodeURIComponent(externalId)}/${graphType}`,
          {
            headers: { "X-Token": token },
            responseType: "arraybuffer",
            timeout: 20000,
          }
        );

        res.setHeader("Content-Type", imgRes.headers["content-type"] || "image/png");
        res.setHeader("Cache-Control", "private, max-age=120");
        res.status(200).send(Buffer.from(imgRes.data));
        return;
      }

      // ------------------------------------------------------------------
      // POST /onu-action/:action/:externalId -> Reboot / Resync / Enable / Disable
      // ------------------------------------------------------------------
      if (req.method === "POST" && reqPath.startsWith("/onu-action/")) {
        const parts = reqPath.slice("/onu-action/".length).split("/");
        const action = parts[0] || "";
        const externalId = decodeURIComponent(parts[1] || "");

        const allowedActions = new Set(["reboot", "resync_config", "enable", "disable"]);
        if (!allowedActions.has(action) || !externalId) {
          res.status(400).json({
            status: false,
            error: "Ação ou ONU inválida.",
          });
          return;
        }

        const { baseUrl, token } = getSmartOltConfig();
        console.log(
          `⚡ [SmartOLT Proxy] Usuário ${decodedUser.email || decodedUser.uid} executando ${action} na ONU ${externalId}`
        );

        const actionRes = await axios.post(
          `${baseUrl}/onu/${action}/${encodeURIComponent(externalId)}`,
          {},
          {
            headers: { "X-Token": token, Accept: "application/json" },
            timeout: 25000,
          }
        );

        // Limpa cache de status em ações que alteram estado administrativo
        if (action === "enable" || action === "disable") {
          memCache.delete("onu_statuses");
        }

        res.status(200).json({
          status: Boolean(actionRes.data?.status ?? true),
          message:
            actionRes.data?.response ||
            actionRes.data?.message ||
            "Comando enviado com sucesso para a OLT.",
          raw: actionRes.data,
        });
        return;
      }

      res.status(404).json({
        status: false,
        error: `Rota SmartOLT não suportada: ${reqPath}`,
      });
    } catch (error: unknown) {
      const errObj = error as {
        message?: string;
        response?: { status?: number; data?: { error?: string; response?: string; message?: string } };
      };
      const statusCode = errObj?.response?.status || 500;
      const errMsg =
        errObj?.response?.data?.error ||
        errObj?.response?.data?.response ||
        errObj?.response?.data?.message ||
        errObj?.message ||
        "Erro ao comunicar com SmartOLT";

      console.error(`❌ [SmartOLT Proxy] Falha em ${reqPath}:`, errMsg);
      res.status(statusCode >= 400 && statusCode < 600 ? statusCode : 500).json({
        status: false,
        error: errMsg,
      });
    }
  });

// ============================================================================
// 2. SMARTOLT REAL-TIME WEBHOOK (PON / OLT OUTAGES + UNCONFIGURED ONUS)
// ============================================================================

interface SmartOltWebhookEvent {
  id?: string;
  event?: string;
  type?: string;
  timestamp?: string;
  data?: Record<string, unknown>;
}

function verifySmartOltSignature(req: functions.https.Request): boolean {
  const secret = process.env.SMARTOLT_WEBHOOK_SECRET?.trim();
  if (!secret) return true; // opcional até o usuário configurar o Signing Secret

  const signatureHeader = String(req.headers["webhook-signature"] || "");
  const webhookId = String(req.headers["webhook-id"] || "");
  const webhookTs = String(req.headers["webhook-timestamp"] || "");
  if (!signatureHeader || !webhookId || !webhookTs) return false;

  const rawBody = req.rawBody ? req.rawBody.toString("utf8") : JSON.stringify(req.body || {});
  const signedPayload = `${webhookId}.${webhookTs}.${rawBody}`;
  const expected = crypto.createHmac("sha256", secret).update(signedPayload).digest("base64");
  const expectedHex = crypto.createHmac("sha256", secret).update(signedPayload).digest("hex");

  return signatureHeader.includes(expected) || signatureHeader.includes(expectedHex);
}

export const smartOltWebhook = functions
  .runWith({ memory: "256MB", timeoutSeconds: 30 })
  .https.onRequest(async (req, res) => {
    if (req.method !== "POST") {
      res.status(200).json({ ok: true, service: "AVL SmartOLT Webhook" });
      return;
    }

    if (!verifySmartOltSignature(req)) {
      console.warn("⚠️ [SmartOLT Webhook] Assinatura HMAC inválida.");
      res.status(401).json({ ok: false, error: "Invalid signature" });
      return;
    }

    try {
      const payload = (req.body || {}) as Record<string, unknown>;
      const webhookId = String(req.headers["webhook-id"] || payload.id || Date.now());

      const rawEvents: SmartOltWebhookEvent[] = Array.isArray(payload.events)
        ? (payload.events as SmartOltWebhookEvent[])
        : [payload as SmartOltWebhookEvent];

      const criticalTypes = new Set([
        "pon.outage_started",
        "pon.outage_ended",
        "olt.outage_started",
        "olt.outage_ended",
        "onu.unconfigured_detected",
      ]);

      const db = admin.firestore();
      let storedCount = 0;
      const outageAlerts: string[] = [];

      for (const ev of rawEvents) {
        const evType = String(ev.event || ev.type || "");
        if (evType === "webhook.test") {
          res.status(200).json({ ok: true, test: true });
          return;
        }
        if (!criticalTypes.has(evType)) continue;

        const docId = `${webhookId}_${ev.id || storedCount}`.replace(/[^a-zA-Z0-9_-]/g, "_");
        const evData = (ev.data || ev) as Record<string, unknown>;

        await db
          .collection("smartolt_events")
          .doc(docId)
          .set(
            {
              webhookId,
              type: evType,
              data: evData,
              receivedAt: admin.firestore.FieldValue.serverTimestamp(),
              eventTimestamp: ev.timestamp || new Date().toISOString(),
            },
            { merge: true }
          );
        storedCount += 1;

        if (
          evType === "pon.outage_started" ||
          evType === "pon.outage_ended" ||
          evType === "olt.outage_started" ||
          evType === "olt.outage_ended"
        ) {
          const oltName = String(evData.olt_name || evData.olt_id || "OLT");
          const ponLabel =
            evData.board !== undefined && evData.port !== undefined
              ? ` • PON ${evData.board}/${evData.port}`
              : "";
          const affected = evData.affected_onus || evData.subscribers || "";
          const icon = evType.endsWith("started") ? "🚨" : "✅";
          const title =
            evType === "pon.outage_started"
              ? "QUEDA DE PORTA PON DETECTADA"
              : evType === "pon.outage_ended"
              ? "PORTA PON NORMALIZADA"
              : evType === "olt.outage_started"
              ? "QUEDA DE OLT DETECTADA"
              : "OLT NORMALIZADA";

          outageAlerts.push(
            `${icon} *${title} (SmartOLT)*\n` +
              `📡 *Equipamento:* ${oltName}${ponLabel}\n` +
              (affected ? `👥 *ONUs afetadas:* ${affected}\n` : "") +
              `🕒 *Horário:* ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`
          );
        }
      }

      // Dispara alerta no grupo NOC do WhatsApp apenas se configurado em configs/smartolt_alerts
      if (outageAlerts.length > 0) {
        const cfgSnap = await db.collection("configs").doc("smartolt_alerts").get();
        const cfg = cfgSnap.exists ? cfgSnap.data() : null;
        const groupPhone = String(cfg?.whatsappGroupPhone || "").trim();
        if (cfg?.enabled === true && groupPhone) {
          const { apiKey, baseUrl } = getWhapiConfig();
          const wa = new WhatsAppService(baseUrl, apiKey);
          await wa.sendTextMessage(groupPhone, outageAlerts.join("\n\n")).catch((err) => {
            console.error("⚠️ [SmartOLT Webhook] Falha ao enviar alerta WhatsApp:", err);
          });
        }
      }

      // Invalida cache local se houve mudança crítica
      if (storedCount > 0) {
        memCache.delete("onu_statuses");
        memCache.delete("unconfigured");
      }

      res.status(200).json({ ok: true, processed: storedCount });
    } catch (err) {
      console.error("❌ [SmartOLT Webhook] Erro:", err);
      res.status(500).json({ ok: false });
    }
  });

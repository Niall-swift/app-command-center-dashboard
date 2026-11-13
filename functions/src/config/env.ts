import * as functions from "firebase-functions/v1";

/**
 * Lê a primeira variável de ambiente não vazia da lista ou lança erro explícito.
 * Evita qualquer token hardcoded no código-fonte.
 */
export function getRequiredEnv(names: string[], label: string): string {
  for (const name of names) {
    const val = process.env[name]?.trim();
    if (val) return val;
  }
  throw new functions.https.HttpsError(
    "failed-precondition",
    `Variável de ambiente obrigatória ausente no servidor: ${label} (${names.join(" / ")}).`
  );
}

/**
 * Lê a primeira variável de ambiente não vazia ou retorna um padrão não-sensível (ex: URL base).
 */
export function getOptionalEnv(names: string[], fallback: string): string {
  for (const name of names) {
    const val = process.env[name]?.trim();
    if (val) return val;
  }
  return fallback;
}

/** Retorna host e token configurados para a API do ISPFY. */
export function getIspfyConfig() {
  const host = getOptionalEnv(
    ["ISPFY_HOST", "ISPFY_URL"],
    "http://avltelecom.ispfycloud.com.br:8020"
  ).replace(/\/$/, "");
  const token = getRequiredEnv(["ISPFY_TOKEN"], "ISPFY_TOKEN");
  return { host, token };
}

/** Retorna URL e header Basic configurados para a API do IXC. */
export function getIxcConfig() {
  let host = getOptionalEnv(
    ["IXC_HOST", "IXC_URL"],
    "https://coopertecisp.com.br/webservice/v1"
  );
  if (host.includes("/api/ixc")) {
    host = "https://coopertecisp.com.br/webservice/v1";
  }
  const token = getRequiredEnv(["IXC_TOKEN"], "IXC_TOKEN");
  const authHeader = `Basic ${Buffer.from(token).toString("base64")}`;
  return { host: host.replace(/\/$/, ""), token, authHeader };
}

/** Retorna baseUrl e token configurados para a API do SmartOLT. */
export function getSmartOltConfig() {
  const url = getOptionalEnv(["SMARTOLT_URL"], "https://ncbrasil.smartolt.com/api");
  const token = getRequiredEnv(["SMARTOLT_TOKEN"], "SMARTOLT_TOKEN");
  return {
    baseUrl: url.replace("/system/", "").replace(/\/$/, ""),
    token,
  };
}

/** Retorna chave e URL base configuradas para envio de WhatsApp (Whapi/Z-API). */
export function getWhapiConfig() {
  const apiKey = getRequiredEnv(
    ["WHAPI_KEY", "WHAPI_API_KEY", "ZAPI_CLIENT_TOKEN"],
    "WHAPI_KEY / ZAPI_CLIENT_TOKEN"
  );
  const baseUrl = getRequiredEnv(["WHAPI_BASE_URL"], "WHAPI_BASE_URL");
  return { apiKey, baseUrl };
}


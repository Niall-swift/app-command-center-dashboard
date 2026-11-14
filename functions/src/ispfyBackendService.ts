import axios, { AxiosInstance } from "axios";
import * as https from "https";
import { getIspfyConfig } from "./config/env";

const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
});

export interface IspfyBoletoDetalhe {
  id: string;
  vencimento: string;
  valor: string;
  linha?: string;
  linkInterno?: string;
  linkPublico?: string;
  pix?: string;
}

export interface IspfyPontoStatus {
  id_ponto: string;
  id_contrato: string;
  nome_ponto?: string;
  bloqueado?: string;
  status_acesso?: string;
  plano_contratado_nome?: string;
  plano_contratado_velocidade?: string;
  plano_teste_nome?: string | null;
  plano_teste_velocidade?: string | null;
  velocidade_atual?: string;
  ultimo_login?: string;
  conexao_status?: string;
  ipv4_atual_wan?: string | null;
  ipv6_atual_wan?: string | null;
  upload_mes_kbytes?: string | number;
  download_mes_kbytes?: string | number;
}

export interface IspfyRegiaoManutencao {
  id: string;
  bairro: string;
  bairros?: string[];
  bairroKey: string;
  cidade?: string;
  titulo?: string;
  motivo?: string;
  mensagem?: string;
  previsao?: string;
  ativa: boolean;
  clientesAfetados?: number;
}

export function extractIspfyRows<T = Record<string, any>>(payload: any): T[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.rows)) return payload.rows;
  if (Array.isArray(payload.registros)) return payload.registros;
  return [];
}

export function normalizeDigits(value?: string | null): string {
  return String(value || "").replace(/\D/g, "");
}

export function formatCpfCnpjMask(digits: string): string {
  const clean = normalizeDigits(digits);
  if (clean.length === 11) {
    return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }
  if (clean.length === 14) {
    return clean.replace(
      /(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,
      "$1.$2.$3/$4-$5"
    );
  }
  return digits;
}

export function normalizeTextKey(value?: string | null): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function buildPhoneVariants(rawPhone: string): string[] {
  const digits = normalizeDigits(rawPhone);
  if (!digits) return [];
  const noCountry = digits.startsWith("55") && digits.length >= 12
    ? digits.slice(2)
    : digits;
  const variants = new Set<string>([digits, noCountry]);
  if (noCountry.length === 11) {
    // Formato com e sem o 9º dígito para comparação tolerante
    variants.add(`${noCountry.slice(0, 2)}${noCountry.slice(3)}`);
  } else if (noCountry.length === 10) {
    variants.add(`${noCountry.slice(0, 2)}9${noCountry.slice(2)}`);
  }
  if (digits.length >= 8) {
    variants.add(digits.slice(-8));
  }
  return Array.from(variants).filter(Boolean);
}

/**
 * Cliente unificado da API ISPFY para todas as Firebase Cloud Functions.
 * Suporta rotas Object (/api/object/*), Tools (/api/tool/*), Parceiros e SVA.
 */
export class IspfyBackendService {
  public readonly host: string;
  public readonly token: string;
  private readonly http: AxiosInstance;

  constructor(host?: string, token?: string) {
    const config = host && token ? { host, token } : getIspfyConfig();
    this.host = config.host.replace(/\/$/, "");
    this.token = config.token;
    this.http = axios.create({
      baseURL: this.host,
      timeout: 30000,
      httpsAgent,
      headers: {
        "Content-Type": "application/json",
        Token: this.token,
      },
    });
  }

  private normalizeObjectPath(path: string): string {
    if (path.startsWith("/api/")) return path;
    const suffix = path.startsWith("/") ? path : `/${path}`;
    return `/api/object${suffix}`;
  }

  async fetchObject<T = Record<string, any>>(
    path: string,
    params: Record<string, any> = {},
    timeout = 20000
  ): Promise<T[]> {
    const resp = await this.http.get(this.normalizeObjectPath(path), {
      params: { pagination: "FALSE", ...params },
      timeout,
    });
    return extractIspfyRows<T>(resp.data);
  }

  async fetchAllObject<T = Record<string, any>>(
    path: string,
    params: Record<string, any> = {},
    pageSize = 500,
    maxPages = 30
  ): Promise<T[]> {
    const all: T[] = [];
    for (let page = 0; page < maxPages; page++) {
      const offset = page * pageSize;
      const resp = await this.http.get(this.normalizeObjectPath(path), {
        params: {
          pagination: "TRUE",
          limit: pageSize,
          offset,
          ...params,
        },
        timeout: 25000,
      });
      const rows = extractIspfyRows<T>(resp.data);
      if (rows.length === 0) break;
      all.push(...rows);
      if (rows.length < pageSize) break;
    }
    return all;
  }

  async postObject<T = any>(
    path: string,
    body: Record<string, any>
  ): Promise<T> {
    const resp = await this.http.post(this.normalizeObjectPath(path), body);
    return resp.data;
  }

  async putObject<T = any>(
    path: string,
    body: Record<string, any>
  ): Promise<T> {
    const resp = await this.http.put(this.normalizeObjectPath(path), body);
    return resp.data;
  }

  // =========================================================================
  // TOOLS & PARCEIROS OFICIAIS (/api/tool/*)
  // =========================================================================

  /** Retorna dados cadastrais, contratos, pontos, cobranças e chamados em 1 chamada. */
  async consultarAssinanteInfo(docOrDigits: string): Promise<any | null> {
    const clean = normalizeDigits(docOrDigits);
    const candidates = Array.from(
      new Set([
        formatCpfCnpjMask(clean),
        clean,
        docOrDigits.trim(),
      ].filter(Boolean))
    );

    for (const candidate of candidates) {
      try {
        const resp = await this.http.get("/api/tool/assinante/info", {
          params: { doc: candidate },
          timeout: 15000,
        });
        if (resp.data && (resp.data.id || resp.data.cpf_cnpj)) {
          return resp.data;
        }
      } catch {
        // tenta próximo formato
      }
    }
    return null;
  }

  /**
   * Consulta segunda via oficial via /api/tool/assinante/boleto com PIX Copia e Cola,
   * linha digitável e link público/impressão.
   */
  async consultarBoletosAssinante(
    docOrDigits: string,
    options?: {
      status?: "aberto" | "vencido" | "pago" | string;
      tipo?: "fatura" | "carne" | string;
    }
  ): Promise<IspfyBoletoDetalhe[]> {
    const clean = normalizeDigits(docOrDigits);
    if (!clean) return [];
    const masked = formatCpfCnpjMask(clean);

    const baseParams: Record<string, any> = {
      doc: masked,
      tipo: options?.tipo || "fatura",
    };
    if (options?.status) {
      baseParams.status = options.status;
    }

    const fetchMode = async (docValue: string) => {
      const [detalhesResp, linksResp] = await Promise.all([
        this.http
          .get("/api/tool/assinante/boleto", {
            params: { ...baseParams, doc: docValue, retorno: "linha_detalhes_json" },
            timeout: 15000,
          })
          .catch(() => null),
        this.http
          .get("/api/tool/assinante/boleto", {
            params: { ...baseParams, doc: docValue, retorno: "link_json" },
            timeout: 15000,
          })
          .catch(() => null),
      ]);

      const cobrancas: any[] = Array.isArray(detalhesResp?.data?.cobrancas)
        ? detalhesResp!.data.cobrancas
        : [];
      const links: string[] = Array.isArray(linksResp?.data?.links)
        ? linksResp!.data.links
        : [];

      return cobrancas.map((item, idx) => {
        const idStr = String(item?.id || "");
        const matchedPublicLink =
          links.find((l) => idStr && String(l).endsWith(`/${idStr}`)) ||
          links[idx];
        return {
          id: idStr,
          vencimento: String(item?.vencimento || ""),
          valor: String(item?.valor || ""),
          linha: item?.linha ? String(item.linha) : undefined,
          linkInterno: item?.link ? String(item.link) : undefined,
          linkPublico: matchedPublicLink ? String(matchedPublicLink) : undefined,
          pix: item?.pix ? String(item.pix) : undefined,
        };
      });
    };

    const viaMask = await fetchMode(masked);
    if (viaMask.length > 0 || masked === clean) return viaMask;
    return fetchMode(clean);
  }

  /** Status detalhado dos pontos de internet do cliente. */
  async consultarStatusPontos(idCliente: string): Promise<IspfyPontoStatus[]> {
    const resp = await this.http.get("/api/tool/assinante/ponto/status", {
      params: { id_cliente: idCliente },
      timeout: 15000,
    });
    return extractIspfyRows<IspfyPontoStatus>(resp.data);
  }

  /** Consumo agregado de upload/download em kbytes para janela máxima de 30 dias. */
  async consultarConsumoPonto(
    idPonto: string,
    dataInicial: string,
    dataFinal: string
  ): Promise<{
    id_ponto: string;
    data_inicial: string;
    data_final: string;
    upload_mes_kbytes: number;
    download_mes_kbytes: number;
  }> {
    const resp = await this.http.get("/api/tool/assinante/ponto/consumo", {
      params: {
        id_ponto: idPonto,
        data_inicial: dataInicial,
        data_final: dataFinal,
      },
      timeout: 15000,
    });
    const d = resp.data || {};
    return {
      id_ponto: String(d.id_ponto || idPonto),
      data_inicial: String(d.data_inicial || dataInicial),
      data_final: String(d.data_final || dataFinal),
      upload_mes_kbytes: Number(d.upload_mes_kbytes || 0),
      download_mes_kbytes: Number(d.download_mes_kbytes || 0),
    };
  }

  /** Desbloqueio de confiança de 3 dias via Tool oficial com fallback para rota Object. */
  async liberarEmConfianca(
    idContrato: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const resp = await this.http.post(
        "/api/tool/assinante/liberar",
        { id_contrato: idContrato },
        { validateStatus: () => true }
      );
      const text =
        typeof resp.data === "string"
          ? resp.data
          : resp.data?.message || JSON.stringify(resp.data || "");

      if (resp.status >= 200 && resp.status < 300) {
        if (
          text.toLowerCase().includes("não está ativa") ||
          text.toLowerCase().includes("nao esta ativa") ||
          resp.data?.type === "error"
        ) {
          return { success: false, message: text || "Liberação indisponível para este contrato." };
        }
        return {
          success: true,
          message: "Contrato liberado em confiança por 3 dias com sucesso!",
        };
      }
    } catch {
      // fallback abaixo
    }

    try {
      const respObj = await this.http.post(
        "/api/object/cliente/contrato_desbloqueio",
        { id: idContrato }
      );
      if (respObj.data?.type === "error") {
        return {
          success: false,
          message: respObj.data?.message || "Não foi possível liberar em confiança.",
        };
      }
      return {
        success: true,
        message: "Contrato desbloqueado em confiança com sucesso!",
      };
    } catch (err: any) {
      return {
        success: false,
        message:
          err?.response?.data?.message ||
          "Erro ao processar desbloqueio em confiança.",
      };
    }
  }

  /**
   * Abre ticket tratando a peculiaridade do ISPFY que devolve o ID do ticket
   * como HTTP status code no POST /api/tool/assinante/ticket.
   */
  async criarTicket(payload: {
    id_cliente: string;
    id_ponto?: string;
    id_topico?: string;
    requisicao: string;
    prioridade?: string;
  }): Promise<{ success: boolean; id?: string; message: string }> {
    const body: Record<string, any> = {
      id_cliente: payload.id_cliente,
      requisicao: payload.requisicao,
    };
    if (payload.id_ponto) body.id_ponto = payload.id_ponto;
    if (payload.id_topico) body.id_topico = payload.id_topico;

    try {
      const resp = await this.http.post("/api/tool/assinante/ticket", body, {
        validateStatus: () => true,
      });

      if (resp.status >= 600) {
        return {
          success: true,
          id: String(resp.status),
          message: "Chamado aberto com sucesso no ISPFY!",
        };
      }

      if (resp.status >= 200 && resp.status < 300 && resp.data?.type !== "error") {
        const raw = resp.data;
        const id =
          typeof raw === "number" || typeof raw === "string"
            ? String(raw).trim()
            : String(raw?.id ?? raw?.dados?.id ?? raw?.ticket?.id ?? "");
        return {
          success: true,
          id: id || undefined,
          message: "Chamado aberto com sucesso no ISPFY!",
        };
      }
    } catch (err: any) {
      const msg = String(err?.message || "");
      const statusMatch = msg.match(/Invalid status code:\s*(\d+)/i);
      if (statusMatch?.[1]) {
        return {
          success: true,
          id: statusMatch[1],
          message: "Chamado aberto com sucesso no ISPFY!",
        };
      }
    }

    // Fallback rota Object
    try {
      const objResp = await this.postObject("/suporte/ticket", {
        id_cliente: payload.id_cliente,
        id_topico: payload.id_topico,
        assunto: payload.requisicao.substring(0, 100),
        descricao: payload.requisicao,
        prioridade: payload.prioridade || "Média",
        setor: "TECNICO",
      });
      if (objResp?.type !== "error") {
        const id = String(objResp?.id ?? objResp?.dados?.id ?? "");
        return {
          success: true,
          id: id || undefined,
          message: "Chamado aberto com sucesso!",
        };
      }
      return {
        success: false,
        message: objResp?.message || "Erro ao abrir ticket.",
      };
    } catch (err: any) {
      return {
        success: false,
        message: err?.response?.data?.message || err?.message || "Falha ao abrir ticket.",
      };
    }
  }

  /** Encerra um ticket aberto no ISPFY. */
  async fecharTicket(
    idTicket: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const resp = await this.http.delete(
        `/api/tool/assinante/ticket/${encodeURIComponent(idTicket)}`
      );
      if (resp.data?.type === "error") {
        return {
          success: false,
          message: resp.data?.message || "Não foi possível encerrar o ticket.",
        };
      }
      return { success: true, message: `Ticket #${idTicket} encerrado no ISPFY!` };
    } catch (err: any) {
      return {
        success: false,
        message: err?.response?.data?.message || err?.message || "Erro ao fechar ticket.",
      };
    }
  }

  /** Cadastra um novo cliente (com coordenadas e abertura opcional de ticket). */
  async criarNovoCliente(
    payload: Record<string, any>
  ): Promise<{ success: boolean; id?: string; message: string }> {
    try {
      const resp = await this.http.post("/api/tool/cliente/novo", payload);
      const id = resp.data?.id ? String(resp.data.id) : undefined;
      if (resp.data?.type === "error") {
        return { success: false, message: resp.data?.message || "Erro ao cadastrar." };
      }
      return {
        success: true,
        id,
        message: id ? `Cliente #${id} cadastrado no ISPFY!` : "Cliente cadastrado no ISPFY!",
      };
    } catch (err: any) {
      return {
        success: false,
        message: err?.response?.data?.message || err?.message || "Erro ao cadastrar cliente.",
      };
    }
  }

  /** Lista planos disponíveis para teste temporário (Turbo) em um ponto. */
  async listarPlanosTestaveis(
    idPonto: string,
    mostrarPrecoMenor = false,
    mostrarBandaMenor = false
  ): Promise<any[]> {
    const resp = await this.http.get("/api/tool/assinante/plano/teste", {
      params: {
        id_ponto: idPonto,
        mostrar_preco_menor: mostrarPrecoMenor ? 1 : 0,
        mostrar_banda_menor: mostrarBandaMenor ? 1 : 0,
      },
      timeout: 15000,
    });
    return extractIspfyRows(resp.data);
  }

  /** Ativa plano temporário (Turbo / degustação) até `data_final` (YYYY-MM-DD). */
  async aplicarPlanoTeste(
    idPonto: string,
    idPlano: string,
    dataFinal: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const resp = await this.http.post("/api/tool/assinante/plano/teste", {
        id_ponto: idPonto,
        id_plano: idPlano,
        data_final: dataFinal,
      });
      if (resp.data?.type === "error") {
        return { success: false, message: resp.data?.message || "Falha ao ativar turbo." };
      }
      return {
        success: true,
        message: `Turbo ativado no ponto ${idPonto} até ${dataFinal}!`,
      };
    } catch (err: any) {
      return {
        success: false,
        message: err?.response?.data?.message || err?.message || "Erro ao ativar plano teste.",
      };
    }
  }

  /** Remove plano de teste temporário de um ponto. */
  async removerPlanoTeste(
    idPonto: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      await this.http.delete(
        `/api/tool/assinante/plano/teste/${encodeURIComponent(idPonto)}`
      );
      return { success: true, message: "Plano temporário removido com sucesso!" };
    } catch (err: any) {
      return {
        success: false,
        message: err?.response?.data?.message || err?.message || "Erro ao remover plano teste.",
      };
    }
  }

  /** Sincronização incremental de clientes ativos inseridos após data YYYY-MM-DD. */
  async listarClientesAtivosIncremental(
    dataInsercaoApos: string
  ): Promise<any[]> {
    const resp = await this.http.get(
      "/api/tool/custom-party/appprovedor/clientes/ativos",
      {
        params: { data_insercao_apos: dataInsercaoApos },
        timeout: 25000,
      }
    );
    return extractIspfyRows(resp.data);
  }

  /** Autentica assinante via AppProvedor (documento, nascimento MD5 ou senha MD5). */
  async autenticarAppProvedor(params: {
    mode: "document" | "birthday" | "password" | "central";
    document: string;
    birthdayMd5?: string;
    passwordMd5?: string;
  }): Promise<any | null> {
    const cleanDoc = formatCpfCnpjMask(params.document);
    try {
      if (params.mode === "central") {
        const r = await this.http.post("/api/tool/assinante/login", {
          login: cleanDoc,
          password: params.passwordMd5 || "",
        });
        return r.data?.id ? r.data : null;
      }
      if (params.mode === "password") {
        const r = await this.http.post(
          "/api/tool/custom-party/appprovedor/login-by-password",
          { document: cleanDoc, password: params.passwordMd5 || "" }
        );
        return r.data?.id ? r.data : null;
      }
      if (params.mode === "birthday") {
        const r = await this.http.post(
          "/api/tool/custom-party/appprovedor/login-by-birthday",
          { document: cleanDoc, birthday: params.birthdayMd5 || "" }
        );
        return r.data?.id ? r.data : null;
      }
      const r = await this.http.post(
        "/api/tool/custom-party/appprovedor/login-by-document",
        { document: cleanDoc }
      );
      return r.data?.id ? r.data : null;
    } catch {
      return null;
    }
  }

  /** Baixa script MikroTik de resgate PPPoE ou IP-Binding diretamente do ISPFY. */
  async obterScriptMikrotik(
    tipo: "secrets" | "binding",
    query: { key: string; time?: string; iface?: string }
  ): Promise<string> {
    const endpoint =
      tipo === "secrets"
        ? "/api/tool/mikrotik/script/secrets"
        : "/api/tool/mikrotik/script/binding";
    const resp = await this.http.get<string>(endpoint, {
      params: query,
      responseType: "text",
      timeout: 20000,
    });
    return typeof resp.data === "string"
      ? resp.data
      : JSON.stringify(resp.data || "");
  }

  /** Consulta autorização SVA na porta :8008 do host ISPFY. */
  async consultarSvaGeneric(
    username: string,
    password: string
  ): Promise<{ authorized: boolean; packages?: string[]; error?: string }> {
    try {
      const urlObj = new URL(this.host);
      const svaUrl = `${urlObj.protocol}//${urlObj.hostname}:8008/api/sva/generic/auth`;
      const resp = await axios.get(svaUrl, {
        params: { username, password },
        timeout: 10000,
        httpsAgent,
        validateStatus: () => true,
      });
      if (Array.isArray(resp.data)) {
        return { authorized: true, packages: resp.data.map(String) };
      }
      return {
        authorized: false,
        error: resp.data?.error || "Acesso SVA não autorizado.",
      };
    } catch (err: any) {
      return { authorized: false, error: err?.message || "Erro ao consultar SVA." };
    }
  }

  // =========================================================================
  // HELPERS DE BUSCA UNIFICADA PARA BOT, IA, CRONS & APP
  // =========================================================================

  async buscarClientePorId(id: string): Promise<any | null> {
    const rows = await this.fetchObject("/cliente", {
      filter: `id:EQ:${id}`,
      limit: 1,
    });
    return rows[0] || null;
  }

  async buscarClientePorDocumento(cpfCnpj: string): Promise<any | null> {
    const digits = normalizeDigits(cpfCnpj);
    if (!digits) return null;

    // 1. Rota oficial assinante/info já traz dados, contratos e faturas
    const info = await this.consultarAssinanteInfo(digits);
    if (info?.id) {
      return {
        ...info,
        razao: info.nome_razao || info.razao || info.nome,
        cnpj_cpf: info.cpf_cnpj || digits,
        bairro: info.endereco_cobranca_bairro || info.bairro,
        endereco: info.endereco_cobranca_rua || info.endereco,
        numero: info.endereco_cobranca_numero || info.numero,
      };
    }

    // 2. Fallback Object /cliente
    const rows = await this.fetchObject("/cliente", {
      filter: `cpf_cnpj:EQ:${digits}`,
      limit: 1,
    });
    if (rows[0]) return rows[0];

    const viaSearch = await this.fetchObject("/cliente", {
      search: digits,
      limit: 5,
    });
    return (
      viaSearch.find((c: any) => normalizeDigits(c.cpf_cnpj || c.cnpj_cpf) === digits) ||
      viaSearch[0] ||
      null
    );
  }

  async buscarContratosPorCliente(idCliente: string): Promise<any[]> {
    return this.fetchObject("/cliente/contrato", {
      filter: `id_cliente:EQ:${idCliente}`,
      limit: 100,
      sort: "id:DESC",
    });
  }

  async buscarContatosPorCliente(idCliente: string): Promise<any[]> {
    return this.fetchObject("/cliente/contato", {
      filter: `id_cliente:EQ:${idCliente}`,
      limit: 50,
    });
  }

  async buscarFaturasAbertasPorCliente(idCliente: string): Promise<any[]> {
    const contratos = await this.buscarContratosPorCliente(idCliente);
    if (contratos.length === 0) return [];

    const listas = await Promise.all(
      contratos.map((c: any) =>
        this.fetchObject("/cliente/contrato/cobranca", {
          filter: `id_contrato:EQ:${c.id} [AND] status:EQ:aberto`,
          limit: 100,
          sort: "data_vencimento:ASC",
        }).catch(() => [])
      )
    );

    return listas
      .flat()
      .filter((f: any) => !f.data_pagamento && !f.pagamento_data);
  }

  /**
   * Localiza cliente pelo número do WhatsApp usando cache Firestore + contatos + clientes.
   */
  async buscarClientePorTelefone(
    rawPhone: string,
    db?: FirebaseFirestore.Firestore
  ): Promise<any | null> {
    const variants = buildPhoneVariants(rawPhone);
    if (variants.length === 0) return null;

    // 1. Consulta rápida no cache incremental de clientes (ispfy_clients_cache)
    if (db) {
      for (const variant of variants.slice(0, 3)) {
        try {
          const snap = await db
            .collection("ispfy_clients_cache")
            .where("phones", "array-contains", variant)
            .limit(1)
            .get();
          if (!snap.empty) {
            const cached = snap.docs[0].data();
            if (cached?.id) {
              const fresh = await this.buscarClientePorId(String(cached.id));
              if (fresh) return fresh;
              return cached;
            }
          }
        } catch {
          // segue para busca direta na API
        }
      }
    }

    const variantSet = new Set(variants);
    const suffix8 = normalizeDigits(rawPhone).slice(-8);

    // 2. Busca por ?search= em /cliente/contato (mais preciso para WhatsApp)
    if (suffix8.length === 8) {
      try {
        const contatos = await this.fetchObject("/cliente/contato", {
          search: suffix8,
          limit: 20,
        });
        const matchContato = contatos.find((ct: any) => {
          const ctDigits = normalizeDigits(ct.contato);
          const ctVariants = buildPhoneVariants(ctDigits);
          return ctVariants.some((v) => variantSet.has(v)) || ctDigits.endsWith(suffix8);
        });
        if (matchContato?.id_cliente) {
          const client = await this.buscarClientePorId(String(matchContato.id_cliente));
          if (client) return client;
        }
      } catch {
        // segue para busca direta em /cliente
      }

      // 3. Busca por ?search= em /cliente
      try {
        const clientes = await this.fetchObject("/cliente", {
          search: suffix8,
          limit: 20,
        });
        const matchCliente = clientes.find((cli: any) => {
          const fields = [
            cli.fone_whatsapp,
            cli.fone_celular,
            cli.telefone_celular,
            cli.fone_residencial,
          ];
          return fields.some((f) => {
            const d = normalizeDigits(f);
            return d && (buildPhoneVariants(d).some((v) => variantSet.has(v)) || d.endsWith(suffix8));
          });
        });
        if (matchCliente) return matchCliente;
      } catch {
        // não encontrado
      }
    }

    return null;
  }

  /** Extrai o melhor telefone válido para WhatsApp de um cliente + seus contatos. */
  async resolverMelhorTelefoneCliente(cliente: any): Promise<string | null> {
    if (!cliente) return null;
    const candidatosCliente = [
      cliente.fone_whatsapp,
      cliente.fone_celular,
      cliente.telefone_celular,
      cliente.fone_residencial,
    ];
    for (const cand of candidatosCliente) {
      const digits = normalizeDigits(cand);
      if (digits.length >= 10) return digits;
    }

    if (cliente.id) {
      const contatos = await this.buscarContatosPorCliente(String(cliente.id)).catch(
        () => []
      );
      for (const ct of contatos) {
        if (ct.pode_enviar_mensagem === "n") continue;
        const digits = normalizeDigits(ct.contato);
        if (digits.length >= 10) return digits;
      }
    }
    return null;
  }

  /** Verifica se há incidente/manutenção massiva ativa para o bairro/cidade no Firestore. */
  async verificarManutencaoAtivaNaRegiao(
    db: FirebaseFirestore.Firestore,
    bairro?: string | null,
    cidade?: string | null
  ): Promise<IspfyRegiaoManutencao | null> {
    const bairroKey = normalizeTextKey(bairro);
    const cidadeKey = normalizeTextKey(cidade);
    if (!bairroKey && !cidadeKey) return null;

    try {
      const snap = await db
        .collection("active_region_outages")
        .where("ativa", "==", true)
        .limit(30)
        .get();
      if (snap.empty) return null;

      for (const doc of snap.docs) {
        const data = doc.data();
        const rawBairros: string[] = Array.isArray(data.bairros)
          ? data.bairros.map(String)
          : data.bairro
            ? [String(data.bairro)]
            : [];
        const docBairroKeys = rawBairros
          .map((b) => normalizeTextKey(b))
          .filter(Boolean);
        if (data.bairroKey) {
          docBairroKeys.push(normalizeTextKey(String(data.bairroKey)));
        }

        const docCidadeKey = normalizeTextKey(data.cidade);
        const bairroBate =
          Boolean(bairroKey) &&
          docBairroKeys.some(
            (dk) => bairroKey === dk || bairroKey.includes(dk) || dk.includes(bairroKey)
          );
        const abrangenciaCidade =
          docBairroKeys.length === 0 && Boolean(cidadeKey) && cidadeKey === docCidadeKey;

        if (bairroBate || abrangenciaCidade) {
          return {
            id: doc.id,
            bairro: rawBairros[0] || String(data.bairro || bairro || ""),
            bairros: rawBairros.length > 0 ? rawBairros : [String(data.bairro || bairro || "")],
            bairroKey: docBairroKeys[0] || "",
            cidade: data.cidade ? String(data.cidade) : undefined,
            titulo: data.titulo ? String(data.titulo) : undefined,
            motivo: data.motivo ? String(data.motivo) : undefined,
            mensagem: data.mensagem ? String(data.mensagem) : undefined,
            previsao: data.previsao || data.previsaoRetorno ? String(data.previsao || data.previsaoRetorno) : undefined,
            ativa: true,
            clientesAfetados: Number(data.clientesAfetados || 0),
          };
        }
      }
    } catch {
      // erro não-fatal ao consultar incidentes
    }
    return null;
  }
}

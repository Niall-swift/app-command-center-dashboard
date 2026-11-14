import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import { verifyAuth } from "./config/auth";
import { getIspfyConfig, getWhapiConfig } from "./config/env";
import { IspfyBackendService, IspfyBoletoDetalhe, normalizeDigits } from "./ispfyBackendService";
import { WhapiService } from "./whapiService";

if (admin.apps.length === 0) {
  admin.initializeApp();
}

export type BillingRulerStage = "D-2" | "D0" | "D+5" | "D+15";

function getSaoPauloTodayIso(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
}

function addDaysIso(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, (d || 1) + days));
  return dt.toISOString().split("T")[0];
}

function extractIsoDate(value?: string | null): string {
  if (!value) return "";
  const clean = String(value).trim().split(" ")[0];
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(clean)) {
    const [d, m, y] = clean.split("/");
    return `${y}-${m}-${d}`;
  }
  return clean;
}

function formatDateBr(isoDate: string): string {
  const clean = extractIsoDate(isoDate);
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    const [y, m, d] = clean.split("-");
    return `${d}/${m}/${y}`;
  }
  return isoDate;
}

function formatCurrencyBr(valor: unknown): string {
  const num = Number(String(valor || "0").replace(",", "."));
  if (!Number.isFinite(num)) return String(valor || "0,00");
  return `R$ ${num.toFixed(2).replace(".", ",")}`;
}

function resolveStageForDueDate(dueIso: string, todayIso: string): BillingRulerStage | null {
  if (!dueIso) return null;
  if (dueIso === addDaysIso(todayIso, 2)) return "D-2";
  if (dueIso === todayIso) return "D0";
  if (dueIso === addDaysIso(todayIso, -5)) return "D+5";
  if (dueIso === addDaysIso(todayIso, -15)) return "D+15";
  return null;
}

function buildBillingRulerMessage(params: {
  stage: BillingRulerStage;
  clientName: string;
  dueIso: string;
  valor: unknown;
  boleto?: IspfyBoletoDetalhe | null;
}): string {
  const firstName = (params.clientName || "Cliente").trim().split(" ")[0] || "Cliente";
  const vencimentoBr = formatDateBr(params.dueIso);
  const valorBr = formatCurrencyBr(params.valor);

  let header = "";
  if (params.stage === "D-2") {
    header = `Olá, *${firstName}*! Tudo bem? 😊\n\nPassando com antecedência para lembrar que sua fatura *AVL Telecom* vence em *${vencimentoBr}* (daqui a 2 dias).`;
  } else if (params.stage === "D0") {
    header = `Olá, *${firstName}*! 👋\n\nLembrete amigável: sua fatura *AVL Telecom* no valor de *${valorBr}* vence *HOJE (${vencimentoBr})*! 📅`;
  } else if (params.stage === "D+5") {
    header = `Olá, *${firstName}*! Tudo bem?\n\nIdentificamos uma fatura em aberto com vencimento em *${vencimentoBr}* (*${valorBr}*). Caso tenha acontecido algum imprevisto, estamos enviando a 2ª via facilitada abaixo para evitar restrições no sinal. 📶`;
  } else {
    header = `Olá, *${firstName}*! ⚠️\n\n*Aviso importante:* sua fatura de *${vencimentoBr}* (*${valorBr}*) consta em aberto há mais de 15 dias. Para evitar o bloqueio automático da sua conexão, realize o pagamento quanto antes pelo PIX abaixo ou solicite atendimento.`;
  }

  let paymentBlock = `\n\n💰 *Valor:* ${valorBr}\n📅 *Vencimento:* ${vencimentoBr}`;
  if (params.boleto?.pix) {
    paymentBlock += `\n\n💠 *PIX Copia e Cola:*\n${params.boleto.pix}`;
  }
  if (params.boleto?.linha) {
    paymentBlock += `\n\n📄 *Código de Barras:*\n${params.boleto.linha}`;
  }
  const boletoLink = params.boleto?.linkPublico || params.boleto?.linkInterno;
  if (boletoLink) {
    paymentBlock += `\n\n🔗 *Link do Boleto:*\n${boletoLink}`;
  }

  return `${header}${paymentBlock}\n\n_Se você já efetuou o pagamento hoje, pode desconsiderar esta mensagem. Atenciosamente, AVL Telecom._`;
}

/**
 * Executa a régua automática de cobrança (D-2, D0, D+5, D+15) usando faturas e PIX/boleto do ISPFY.
 */
export async function processIspfyBillingRuler(options?: {
  dryRun?: boolean;
  targetStage?: BillingRulerStage;
  targetDate?: string;
  forceRun?: boolean;
}) {
  const db = admin.firestore();
  const cfgSnap = await db.collection("settings").doc("ispfy_automations").get();
  const cfg = cfgSnap.exists ? cfgSnap.data() || {} : {};
  const rulerCfg = cfg.billingRuler || {};

  const dryRun = options?.dryRun === true;
  if (!dryRun && !options?.forceRun && rulerCfg.enabled !== true) {
    console.log("ℹ️ Régua de cobrança ISPFY desativada em settings/ispfy_automations. Execução ignorada.");
    return {
      skipped: true,
      reason: "disabled_in_settings",
      processed: 0,
      sent: 0,
      items: [],
    };
  }

  const { host, token } = getIspfyConfig();
  const { apiKey: whapiKey, baseUrl: whapiUrl } = getWhapiConfig();
  const ispfy = new IspfyBackendService(host, token);
  const whapi = new WhapiService(whapiKey, whapiUrl);

  const todayIso = options?.targetDate || getSaoPauloTodayIso();
  const openInvoices = await ispfy.fetchAllObject(
    "/cliente/contrato/cobranca",
    { filter: "status:EQ:aberto", sort: "data_vencimento:ASC" },
    6
  );

  const contractCache = new Map<string, any>();
  const clientCache = new Map<string, any>();
  const phoneCache = new Map<string, string | null>();
  const boletoCache = new Map<string, IspfyBoletoDetalhe[]>();

  const items: any[] = [];
  let sentCount = 0;

  for (const inv of openInvoices) {
    if (inv.data_pagamento) continue;
    const dueIso = extractIsoDate(inv.data_vencimento);
    const stage = resolveStageForDueDate(dueIso, todayIso);
    if (!stage) continue;
    if (options?.targetStage && stage !== options.targetStage) continue;

    // Respeitar estágios habilitados quando rodando em modo automático
    if (!options?.targetStage && !dryRun) {
      if (stage === "D-2" && rulerCfg.sendD2Reminder === false) continue;
      if (stage === "D0" && rulerCfg.sendD0DueToday === false) continue;
      if (stage === "D+5" && rulerCfg.sendD5Overdue === false) continue;
      if (stage === "D+15" && rulerCfg.sendD15Warning === false) continue;
    }

    const invoiceId = String(inv.id);
    const logId = `${invoiceId}_${stage}`;
    const logRef = db.collection("billing_ruler_logs").doc(logId);
    const logSnap = await logRef.get();
    if (logSnap.exists && !dryRun) {
      continue;
    }

    const contractId = String(inv.id_contrato || "");
    if (!contractId) continue;

    let contract = contractCache.get(contractId);
    if (!contract) {
      const rows = await ispfy
        .fetchObject("/cliente/contrato", { filter: `id:EQ:${contractId}`, limit: 1 })
        .catch(() => []);
      contract = rows[0] || null;
      contractCache.set(contractId, contract);
    }

    if (!contract) continue;
    const contractStatusLower = String(contract.status || "").toLowerCase();
    if (contractStatusLower === "cancelado") continue;

    const clientId = String(contract.id_cliente || inv.id_cliente || "");
    if (!clientId) continue;

    let client = clientCache.get(clientId);
    if (!client) {
      client = await ispfy.buscarClientePorId(clientId).catch(() => null);
      clientCache.set(clientId, client);
    }
    if (!client) continue;

    const clientName = String(client.razao || client.nome_razao || client.nome || "Cliente");
    const cpfCnpj = String(client.cpf_cnpj || client.cnpj_cpf || "");

    let phone = phoneCache.get(clientId);
    if (phone === undefined) {
      phone = await ispfy.resolverMelhorTelefoneCliente(client);
      phoneCache.set(clientId, phone);
    }

    if (!phone) {
      items.push({
        invoiceId,
        stage,
        clientId,
        clientName,
        dueIso,
        valor: inv.valor,
        status: "skipped_no_phone",
      });
      continue;
    }

    let boletos = cpfCnpj ? boletoCache.get(cpfCnpj) : undefined;
    if (cpfCnpj && boletos === undefined) {
      boletos = await ispfy.consultarBoletosAssinante(cpfCnpj, { status: "aberto" }).catch(() => []);
      boletoCache.set(cpfCnpj, boletos);
    }
    const matchedBoleto =
      boletos?.find((b) => String(b.id) === invoiceId) || boletos?.[0] || null;

    const message = buildBillingRulerMessage({
      stage,
      clientName,
      dueIso,
      valor: inv.valor,
      boleto: matchedBoleto,
    });

    if (dryRun) {
      items.push({
        invoiceId,
        stage,
        clientId,
        clientName,
        phone,
        dueIso,
        valor: inv.valor,
        hasPix: Boolean(matchedBoleto?.pix),
        alreadySent: logSnap.exists,
        previewMessage: message,
        status: "dry_run",
      });
      continue;
    }

    const sendRes = await whapi.sendCustomMessage(phone, message);
    await logRef.set({
      invoiceId,
      stage,
      clientId,
      clientName,
      phone,
      dueIso,
      valor: inv.valor,
      hasPix: Boolean(matchedBoleto?.pix),
      status: sendRes.sent ? "sent" : "error",
      error: sendRes.error || null,
      messageId: sendRes.id || null,
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    if (sendRes.sent) sentCount++;
    items.push({
      invoiceId,
      stage,
      clientId,
      clientName,
      phone,
      dueIso,
      status: sendRes.sent ? "sent" : "error",
      error: sendRes.error,
    });

    await new Promise((r) => setTimeout(r, 1500));
  }

  return {
    skipped: false,
    dryRun,
    todayIso,
    processed: items.length,
    sent: sentCount,
    items,
  };
}

/**
 * Sincroniza novos assinantes via `/tool/custom-party/appprovedor/clientes/ativos`,
 * atualiza `ispfy_clients_cache` e dispara boas-vindas se habilitado.
 */
export async function processIspfyWelcomeSync(options?: {
  dryRun?: boolean;
  since?: string;
  forceSend?: boolean;
}) {
  const db = admin.firestore();
  const settingsRef = db.collection("settings").doc("ispfy_automations");
  const cfgSnap = await settingsRef.get();
  const cfg = cfgSnap.exists ? cfgSnap.data() || {} : {};
  const welcomeCfg = cfg.welcomeSync || {};

  const dryRun = options?.dryRun === true;
  const fallbackSince = addDaysIso(getSaoPauloTodayIso(), -2);
  const sinceIso = options?.since || welcomeCfg.lastSyncAt || fallbackSince;

  const { host, token } = getIspfyConfig();
  const ispfy = new IspfyBackendService(host, token);
  const recentClients = await ispfy.listarClientesAtivosIncremental(sinceIso);

  const shouldSendWhatsapp =
    !dryRun && (options?.forceSend === true || welcomeCfg.autoSendWhatsapp === true);
  let whapi: WhapiService | null = null;
  if (shouldSendWhatsapp) {
    const { apiKey, baseUrl } = getWhapiConfig();
    whapi = new WhapiService(apiKey, baseUrl);
  }

  let cachedCount = 0;
  let welcomeSentCount = 0;
  const processed: any[] = [];

  for (const cli of recentClients) {
    const clientId = String(cli.id || cli.id_cliente || "").trim();
    if (!clientId) continue;

    const nome = String(cli.nome || cli.razao || cli.nome_razao || "Cliente");
    const docDigits = normalizeDigits(String(cli.cpf_cnpj || cli.cnpj_cpf || ""));
    const rawPhone = String(cli.fone_whatsapp || cli.fone_celular || cli.telefone || "");
    const phoneDigits = normalizeDigits(rawPhone);

    if (!dryRun) {
      await db.collection("ispfy_clients_cache").doc(clientId).set(
        {
          id: clientId,
          nome,
          cpf_cnpj: docDigits,
          telefone: rawPhone,
          phoneDigits,
          bairro: cli.bairro || "",
          cidade: cli.cidade || "",
          syncedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      cachedCount++;
    }

    let welcomeStatus: string = "cached_only";
    if (shouldSendWhatsapp && whapi && phoneDigits.length >= 10) {
      const welcomeRef = db.collection("welcome_notifications").doc(clientId);
      const welcomeSnap = await welcomeRef.get();
      if (!welcomeSnap.exists) {
        const firstName = nome.trim().split(" ")[0] || "Cliente";
        const msg =
          `Seja muito bem-vindo(a) à *AVL Telecom*, *${firstName}*! 🚀🌐\n\n` +
          `Sua internet já está ativa com a gente! Para facilitar ainda mais seu dia a dia:\n` +
          `• Pelo nosso WhatsApp você tira *2ª via PIX* ou pede *Desbloqueio em Confiança* na hora.\n` +
          `• Baixe o *App Pré-Mix / AVL Telecom* e concorra a prêmios mantendo suas faturas em dia! 🎁\n\n` +
          `_Qualquer dúvida, é só mandar um "Oi" aqui mesmo. Conte com a AVL Telecom!_`;

        const sendRes = await whapi.sendCustomMessage(rawPhone, msg);
        await welcomeRef.set({
          clientId,
          clientName: nome,
          phone: rawPhone,
          status: sendRes.sent ? "sent" : "error",
          error: sendRes.error || null,
          sentAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        if (sendRes.sent) {
          welcomeSentCount++;
          welcomeStatus = "sent";
        } else {
          welcomeStatus = "error";
        }
        await new Promise((r) => setTimeout(r, 1200));
      } else {
        welcomeStatus = "already_welcomed";
      }
    }

    processed.push({
      clientId,
      nome,
      phone: rawPhone,
      welcomeStatus,
    });
  }

  if (!dryRun) {
    await settingsRef.set(
      {
        welcomeSync: {
          ...welcomeCfg,
          lastSyncAt: getSaoPauloTodayIso(),
          lastRunAt: admin.firestore.FieldValue.serverTimestamp(),
        },
      },
      { merge: true }
    );
  }

  return {
    dryRun,
    sinceIso,
    found: recentClients.length,
    cachedCount,
    welcomeSentCount,
    clients: processed,
  };
}

/**
 * Cron diário 09:00 AM (SP): Régua de cobrança automática ISPFY (D-2, D0, D+5, D+15).
 */
export const runIspfyBillingRulerCron = functions
  .runWith({ timeoutSeconds: 540, memory: "512MB" })
  .pubsub.schedule("0 9 * * *")
  .timeZone("America/Sao_Paulo")
  .onRun(async () => {
    try {
      const result = await processIspfyBillingRuler({ dryRun: false });
      console.log("✅ Régua de cobrança finalizada:", {
        skipped: result.skipped,
        processed: result.processed,
        sent: result.sent,
      });
    } catch (error) {
      console.error("❌ Erro no runIspfyBillingRulerCron:", error);
    }
    return null;
  });

/**
 * Acionador manual / simulador (Dry Run) da Régua de Cobrança para a Central de Automações.
 */
export const triggerIspfyBillingRuler = functions
  .runWith({ timeoutSeconds: 540, memory: "512MB" })
  .https.onCall(async (data, context) => {
    verifyAuth(context);
    const dryRun = data?.dryRun !== false;
    const targetStage = data?.stage as BillingRulerStage | undefined;
    const forceRun = data?.forceRun === true;
    return processIspfyBillingRuler({
      dryRun,
      targetStage,
      targetDate: data?.targetDate,
      forceRun,
    });
  });

/**
 * Cron a cada 30 minutos: sincroniza novos clientes ativos e envia boas-vindas se configurado.
 */
export const syncIspfyNewClientsCron = functions
  .runWith({ timeoutSeconds: 300, memory: "256MB" })
  .pubsub.schedule("every 30 minutes")
  .timeZone("America/Sao_Paulo")
  .onRun(async () => {
    try {
      const cfgSnap = await admin.firestore().collection("settings").doc("ispfy_automations").get();
      const welcomeCfg = cfgSnap.exists ? cfgSnap.data()?.welcomeSync || {} : {};
      if (welcomeCfg.enabled === false) {
        return null;
      }
      await processIspfyWelcomeSync({ dryRun: false });
    } catch (error) {
      console.error("❌ Erro no syncIspfyNewClientsCron:", error);
    }
    return null;
  });

/**
 * Acionador manual da sincronização incremental de novos clientes e boas-vindas.
 */
export const triggerIspfyWelcomeSync = functions
  .runWith({ timeoutSeconds: 300, memory: "256MB" })
  .https.onCall(async (data, context) => {
    verifyAuth(context);
    return processIspfyWelcomeSync({
      dryRun: data?.dryRun === true,
      since: data?.since,
      forceSend: data?.forceSend === true,
    });
  });

/**
 * Gerenciador de Turbo Temporário de Velocidade (`/tool/assinante/plano/teste`).
 */
export const manageIspfyTurbo = functions.https.onCall(async (data, context) => {
  verifyAuth(context);
  const action = String(data?.action || "");
  const { host, token } = getIspfyConfig();
  const ispfy = new IspfyBackendService(host, token);
  const db = admin.firestore();

  if (action === "list_testable_plans") {
    const idPonto = String(data?.idPonto || "").trim();
    const plans = idPonto
      ? await ispfy.listarPlanosTestaveis(idPonto, true, Boolean(data?.mostrarBandaMenor))
      : await ispfy.fetchObject("/plano", { filter: "ativo:EQ:s", limit: 200 });
    return { success: true, plans };
  }

  if (action === "activate_turbo") {
    const idPonto = String(data?.idPonto || "").trim();
    const idPlano = String(data?.idPlano || "").trim();
    const dias = Math.min(30, Math.max(1, Number(data?.dias || 7)));
    const dataFinal = String(data?.dataFinal || addDaysIso(getSaoPauloTodayIso(), dias));

    if (!idPonto || !idPlano) {
      throw new functions.https.HttpsError("invalid-argument", "idPonto e idPlano são obrigatórios.");
    }

    const result = await ispfy.aplicarPlanoTeste(idPonto, idPlano, dataFinal);
    if (!result.success) {
      throw new functions.https.HttpsError("failed-precondition", result.message);
    }
    let whatsappSent = false;

    if (data?.notifyWhatsapp && data?.clientPhone) {
      try {
        const { apiKey, baseUrl } = getWhapiConfig();
        const whapi = new WhapiService(apiKey, baseUrl);
        const firstName = String(data?.clientName || "Cliente").trim().split(" ")[0] || "Cliente";
        const planLabel = String(data?.planName || "Turbo de Velocidade");
        const msg =
          `Parabéns, *${firstName}*! 🚀⚡\n\n` +
          `Acabamos de ativar um *Turbo Temporário de Velocidade* (*${planLabel}*) na sua conexão!\n` +
          `📅 Válido até: *${formatDateBr(dataFinal)}*\n\n` +
          `Aproveite a ultravelocidade da *AVL Telecom*!`;
        const sendRes = await whapi.sendCustomMessage(String(data.clientPhone), msg);
        whatsappSent = sendRes.sent;
      } catch (err) {
        console.warn("Aviso ao enviar WhatsApp do Turbo:", err);
      }
    }

    await db.collection("ispfy_turbo_logs").add({
      source: "admin_panel",
      idPonto,
      idPlano,
      planName: data?.planName || null,
      clientName: data?.clientName || null,
      dataFinal,
      whatsappSent,
      operatorUid: context.auth?.uid || "",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { success: true, dataFinal, whatsappSent, result };
  }

  if (action === "remove_turbo") {
    const idPonto = String(data?.idPonto || "").trim();
    if (!idPonto) {
      throw new functions.https.HttpsError("invalid-argument", "idPonto é obrigatório.");
    }
    const result = await ispfy.removerPlanoTeste(idPonto);
    await db.collection("ispfy_turbo_logs").add({
      source: "admin_panel_remove",
      idPonto,
      operatorUid: context.auth?.uid || "",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { success: true, result };
  }

  throw new functions.https.HttpsError("invalid-argument", `Ação desconhecida: ${action}`);
});

/**
 * Ações operacionais do ISPFY para o painel: criar lead/cliente, fechar O.S., script MikroTik e gerenciar rompimento regional.
 */
export const ispfyToolActions = functions.https.onCall(async (data, context) => {
  verifyAuth(context);
  const action = String(data?.action || "");
  const { host, token } = getIspfyConfig();
  const ispfy = new IspfyBackendService(host, token);
  const db = admin.firestore();

  if (action === "create_lead_client") {
    const payload = (data?.payload || {}) as Record<string, unknown>;
    if (!payload.nome_razao && !payload.razao && !payload.nome) {
      throw new functions.https.HttpsError("invalid-argument", "Nome do cliente é obrigatório.");
    }
    const created = await ispfy.criarNovoCliente(payload);
    let ticketResult: any = null;

    if (data?.openInstallTicket && created.id) {
      ticketResult = await ispfy.criarTicket({
        id_cliente: String(created.id),
        id_topico: data?.idTopico ? String(data.idTopico) : undefined,
        requisicao: String(
          data?.ticketDescricao ||
            `${data?.ticketAssunto || "Instalação de Novo Assinante"} — Criado pelo painel AVL Command Center.`
        ),
      });
    }

    await db.collection("ispfy_lead_conversions").add({
      payload,
      created,
      ticketResult,
      operatorUid: context.auth?.uid || "",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { success: created.success, created, ticketResult };
  }

  if (action === "close_ticket") {
    const idTicket = String(data?.idTicket || "").trim();
    if (!idTicket) {
      throw new functions.https.HttpsError("invalid-argument", "idTicket é obrigatório.");
    }
    const closed = await ispfy.fecharTicket(idTicket);
    let whatsappSent = false;

    if (data?.notifyWhatsapp && data?.clientPhone) {
      try {
        const { apiKey, baseUrl } = getWhapiConfig();
        const whapi = new WhapiService(apiKey, baseUrl);
        const firstName = String(data?.clientName || "Cliente").trim().split(" ")[0] || "Cliente";
        const nota = data?.resolutionNote ? `\n📝 *Resumo:* ${data.resolutionNote}` : "";
        const msg =
          `Olá, *${firstName}*! ✅\n\n` +
          `Seu chamado técnico *#${idTicket}* foi *concluído e encerrado* pela equipe da *AVL Telecom*!${nota}\n\n` +
          `De 0 a 10, como você avalia nosso atendimento hoje? Sua opinião ajuda muito a melhorar nossos serviços! 🙌`;
        const res = await whapi.sendCustomMessage(String(data.clientPhone), msg);
        whatsappSent = res.sent;
      } catch (err) {
        console.warn("Aviso ao enviar WhatsApp de encerramento de O.S.:", err);
      }
    }

    return { success: closed.success, whatsappSent, result: closed };
  }

  if (action === "get_mikrotik_script") {
    const tipo = data?.scriptType === "binding" ? "binding" : "secrets";
    const key = String(data?.key || "").trim();
    if (!key) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "A chave (key) do servidor MikroTik no ISPFY é obrigatória."
      );
    }
    const script = await ispfy.obterScriptMikrotik(tipo, {
      key,
      time: data?.time ? String(data.time) : undefined,
      iface: data?.iface ? String(data.iface) : undefined,
    });
    return { success: true, script };
  }

  if (action === "set_region_outage") {
    const outageId = data?.id ? String(data.id) : undefined;
    if (data?.resolve === true && outageId) {
      await db.collection("active_region_outages").doc(outageId).set(
        {
          ativa: false,
          ativo: false,
          resolvedAt: admin.firestore.FieldValue.serverTimestamp(),
          resolvedBy: context.auth?.uid || "",
        },
        { merge: true }
      );
      return { success: true, id: outageId, ativa: false };
    }

    const bairros = Array.isArray(data?.bairros)
      ? data.bairros.map((b: unknown) => String(b).trim()).filter(Boolean)
      : data?.bairro
        ? [String(data.bairro).trim()]
        : [];
    if (bairros.length === 0 || !data?.titulo || !data?.mensagem) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "bairros, titulo e mensagem são obrigatórios para registrar rompimento regional."
      );
    }

    const ativa = data?.ativo !== false && data?.ativa !== false;
    const payload = {
      ativa,
      ativo: ativa,
      bairro: bairros[0],
      bairros,
      cidade: data?.cidade ? String(data.cidade).trim() : null,
      titulo: String(data.titulo).trim(),
      motivo: String(data.titulo).trim(),
      mensagem: String(data.mensagem).trim(),
      previsao: data?.previsaoRetorno ? String(data.previsaoRetorno).trim() : null,
      previsaoRetorno: data?.previsaoRetorno ? String(data.previsaoRetorno).trim() : null,
      clientesAfetados: Number(data?.clientesAfetados || 0),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: context.auth?.uid || "",
    };

    if (outageId) {
      await db.collection("active_region_outages").doc(outageId).set(payload, { merge: true });
      return { success: true, id: outageId, ...payload };
    }

    const docRef = await db.collection("active_region_outages").add({
      ...payload,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { success: true, id: docRef.id, ...payload };
  }

  throw new functions.https.HttpsError("invalid-argument", `Ação desconhecida: ${action}`);
});

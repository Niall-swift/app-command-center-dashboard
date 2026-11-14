import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import axios from "axios";
import * as https from "https";
import { WhapiService } from "./whapiService";
import { getIspfyConfig, getWhapiConfig } from "./config/env";
import { IspfyBackendService, IspfyBoletoDetalhe } from "./ispfyBackendService";

if (admin.apps.length === 0) {
  admin.initializeApp();
}

const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
});

function formatDateBr(dateStr: string): string {
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    const parts = dateStr.split(" ")[0].split("-");
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
  }
  return dateStr;
}

function addDaysToIso(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, (d || 1) + days));
  return dt.toISOString().split("T")[0];
}

/**
 * Normaliza qualquer formato de data (YYYY-MM-DD, DD/MM/YYYY, com ou sem hora) para YYYY-MM-DD
 */
export function extractDateOnly(dateStr?: string | null): string {
  if (!dateStr) return "";
  const clean = String(dateStr).trim().split(" ")[0];
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(clean)) {
    const parts = clean.split("/");
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return clean;
}

/**
 * Gera o texto padrão da mensagem de carência
 */
export function buildCarenciaMessage(nome: string, dataCarencia: string): string {
  const firstName = (nome || "Cliente").trim().split(" ")[0] || "Cliente";
  const dataFormatada = formatDateBr(dataCarencia);

  return `Olá, *${firstName}*! Tudo bem? 📶

Passando para avisar que a sua fatura/conexão foi agendada em *carência até o dia ${dataFormatada}*. 📅

⚠️ *Aviso Importante:*
Lembramos que se passar dessa data limite, o sistema realiza o bloqueio automático e *não será possível agendar novamente*.

📲 *Fique em Dia e Concorra a Prêmios:*
Baixe o aplicativo da *AVL Telecom*, mantenha suas faturas sempre em dia e concorra a vários prêmios incríveis nos sorteios do *Pré-Mix*! 🎁🍀

_Caso tenha dúvidas ou já tenha efetuado o pagamento, entre em contato com nosso atendimento._
_Att, Equipe AVL Telecom_`;
}

/**
 * Gera a mensagem D-1 de lembrete antes do término da carência com PIX Copia e Cola.
 */
export function buildCarenciaD1Message(
  nome: string,
  dataCarencia: string,
  boleto?: IspfyBoletoDetalhe | null
): string {
  const firstName = (nome || "Cliente").trim().split(" ")[0] || "Cliente";
  const dataFormatada = formatDateBr(dataCarencia);

  let paymentBlock = "";
  if (boleto) {
    const valorNum = Number(String(boleto.valor || "0").replace(",", "."));
    const valorFmt = Number.isFinite(valorNum) && valorNum > 0
      ? `R$ ${valorNum.toFixed(2).replace(".", ",")}`
      : String(boleto.valor || "");
    paymentBlock += `\n💵 *Fatura em aberto:* ${valorFmt} (Venc.: ${formatDateBr(boleto.vencimento || dataCarencia)})`;
    if (boleto.pix) {
      paymentBlock += `\n\n💠 *PIX Copia e Cola:*\n${boleto.pix}`;
    }
    const boletoLink = boleto.linkPublico || boleto.linkInterno;
    if (boletoLink) {
      paymentBlock += `\n\n🔗 *Link do Boleto:*\n${boletoLink}`;
    }
  }

  return `Olá, *${firstName}*! Tudo bem? ⏰

Lembrete importante da *AVL Telecom*: sua *liberação em carência vence AMANHÃ (${dataFormatada})*. 📅

⚠️ Para evitar que sua internet seja bloqueada automaticamente após o prazo, realize a quitação até amanhã!${paymentBlock}

_Se você já efetuou o pagamento via PIX ou boleto hoje, pode desconsiderar este aviso. Qualquer dúvida, estamos à disposição!_`;
}

/**
 * Processa todos os contratos em carência no ISPFY:
 * 1) Novas carências concedidas na data de hoje (D0) -> `carencia_notifications`
 * 2) Carências que vencem amanhã (D-1) com envio de PIX/boleto -> `carencia_d1_notifications`
 */
export async function processIspfyCarencias(targetDate?: string) {
  console.log("Iniciando monitoramento de carências ISPFY...");

  const { host: ispfyHost, token: ispfyToken } = getIspfyConfig();
  const { apiKey: whapiApiKey, baseUrl: whapiBaseUrl } = getWhapiConfig();

  const db = admin.firestore();
  const whapiService = new WhapiService(whapiApiKey, whapiBaseUrl);
  const ispfyBackend = new IspfyBackendService(ispfyHost, ispfyToken);
  const results: any[] = [];

  try {
    const today =
      targetDate ||
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Sao_Paulo",
      }).format(new Date());
    const tomorrow = addDaysToIso(today, 1);

    const automationCfgSnap = await db.collection("settings").doc("ispfy_automations").get();
    const automationCfg = automationCfgSnap.exists ? automationCfgSnap.data() || {} : {};
    const d1Enabled = automationCfg.carenciaD1Enabled !== false;

    console.log(`Buscando contratos em carência (D0: ${today} | D-1: ${tomorrow})...`);

    const response = await axios.get(
      `${ispfyHost}/api/object/cliente/contrato`,
      {
        headers: { Token: ispfyToken },
        params: {
          filter: "data_final_carencia:NOT:null",
          limit: 300,
          pagination: "FALSE",
        },
        timeout: 25000,
        httpsAgent,
      }
    );

    const rawContratos = Array.isArray(response.data)
      ? response.data
      : response.data?.data || response.data?.rows || [];

    const clientCache = new Map<string, { name: string; phone: string | null; cpfCnpj: string | null }>();
    const resolveClientInfo = async (idCliente: string | null) => {
      if (!idCliente) {
        return { name: "Cliente", phone: null as string | null, cpfCnpj: null as string | null };
      }
      const cached = clientCache.get(idCliente);
      if (cached) return cached;

      let clientName = "Cliente";
      let phone: string | null = null;
      let cpfCnpj: string | null = null;

      try {
        const cliente = await ispfyBackend.buscarClientePorId(idCliente);
        if (cliente) {
          clientName = cliente.nome_razao || cliente.razao || cliente.nome || "Cliente";
          cpfCnpj = cliente.cpf_cnpj || cliente.cnpj_cpf || null;
          phone = await ispfyBackend.resolverMelhorTelefoneCliente(cliente);
        }
      } catch (err: any) {
        console.error(`Erro ao buscar dados do cliente ${idCliente}:`, err.message);
      }

      const resolved = { name: clientName, phone, cpfCnpj };
      clientCache.set(idCliente, resolved);
      return resolved;
    };

    // 1. Concessões de hoje (D0)
    const contratosHoje = rawContratos.filter((c: any) => {
      const ultimaCarencia = extractDateOnly(c.data_ultima_carencia);
      const finalDate = extractDateOnly(c.data_final_carencia);
      return ultimaCarencia === today && !!finalDate && finalDate !== "0000-00-00" && finalDate >= today;
    });

    console.log(
      `${contratosHoje.length} contrato(s) com carência concedida em ${today} (de ${rawContratos.length} analisados).`
    );

    for (const contrato of contratosHoje) {
      const contratoId = String(contrato.id);
      const dataFinalCarencia = extractDateOnly(contrato.data_final_carencia);
      const idCliente = contrato.id_cliente ? String(contrato.id_cliente) : null;

      if (!dataFinalCarencia) continue;

      const notificationDocId = `${contratoId}_${dataFinalCarencia}`;
      const docRef = db.collection("carencia_notifications").doc(notificationDocId);
      const docSnap = await docRef.get();

      if (docSnap.exists) {
        results.push({
          type: "d0",
          contratoId,
          dataFinalCarencia,
          status: "skipped",
          reason: "already_notified",
        });
        continue;
      }

      const { name: clientName, phone, cpfCnpj } = await resolveClientInfo(idCliente);

      if (!phone) {
        await docRef.set({
          contratoId,
          clienteId: idCliente,
          clienteNome: clientName,
          telefone: null,
          dataFinalCarencia,
          status: "skipped",
          motivo: "sem_telefone",
          processadoEm: admin.firestore.FieldValue.serverTimestamp(),
        });
        results.push({ type: "d0", contratoId, clienteId: idCliente, status: "skipped", reason: "no_phone" });
        continue;
      }

      const messageBody = buildCarenciaMessage(clientName, dataFinalCarencia);
      console.log(`Enviando carência D0 para ${clientName} (${phone}) - Contrato ${contratoId}`);

      const sendResult = await whapiService.sendCustomMessage(phone, messageBody);

      if (sendResult.sent) {
        await docRef.set({
          contratoId,
          clienteId: idCliente,
          clienteNome: clientName,
          clienteCpfCnpj: cpfCnpj,
          telefone: phone,
          dataFinalCarencia,
          dataUltimaCarencia: contrato.data_ultima_carencia || null,
          mensagem: messageBody,
          messageId: sendResult.id || null,
          status: "sent",
          enviadoEm: admin.firestore.FieldValue.serverTimestamp(),
        });

        results.push({
          type: "d0",
          contratoId,
          clienteNome: clientName,
          telefone: phone,
          dataFinalCarencia,
          status: "sent",
          messageId: sendResult.id,
        });
      } else {
        await docRef.set({
          contratoId,
          clienteId: idCliente,
          clienteNome: clientName,
          telefone: phone,
          dataFinalCarencia,
          status: "error",
          erro: sendResult.error || "Falha no envio da mensagem",
          tentadoEm: admin.firestore.FieldValue.serverTimestamp(),
        });
        results.push({ type: "d0", contratoId, clienteNome: clientName, status: "failed", error: sendResult.error });
      }

      await new Promise((r) => setTimeout(r, 1500));
    }

    // 2. Lembrete D-1 para carências que vencem amanhã
    if (d1Enabled) {
      const contratosVencendoAmanha = rawContratos.filter((c: any) => {
        const finalDate = extractDateOnly(c.data_final_carencia);
        const isAtivo = String(c.status || "").toLowerCase() !== "cancelado" && c.ativo !== false;
        return finalDate === tomorrow && isAtivo;
      });

      console.log(`${contratosVencendoAmanha.length} contrato(s) com carência vencendo amanhã (${tomorrow}).`);

      for (const contrato of contratosVencendoAmanha) {
        const contratoId = String(contrato.id);
        const dataFinalCarencia = extractDateOnly(contrato.data_final_carencia);
        const idCliente = contrato.id_cliente ? String(contrato.id_cliente) : null;
        if (!dataFinalCarencia) continue;

        const d1DocId = `${contratoId}_${dataFinalCarencia}`;
        const d1Ref = db.collection("carencia_d1_notifications").doc(d1DocId);
        const d1Snap = await d1Ref.get();
        if (d1Snap.exists) continue;

        const { name: clientName, phone, cpfCnpj } = await resolveClientInfo(idCliente);
        if (!phone) {
          await d1Ref.set({
            contratoId,
            clienteId: idCliente,
            clienteNome: clientName,
            dataFinalCarencia,
            status: "skipped",
            motivo: "sem_telefone",
            processadoEm: admin.firestore.FieldValue.serverTimestamp(),
          });
          continue;
        }

        let firstOpenBoleto: IspfyBoletoDetalhe | null = null;
        if (cpfCnpj) {
          const boletos = await ispfyBackend
            .consultarBoletosAssinante(cpfCnpj, { status: "aberto" })
            .catch(() => []);
          firstOpenBoleto = boletos[0] || null;
        }

        const d1Message = buildCarenciaD1Message(clientName, dataFinalCarencia, firstOpenBoleto);
        console.log(`Enviando lembrete D-1 carência para ${clientName} (${phone}) - Contrato ${contratoId}`);
        const sendResult = await whapiService.sendCustomMessage(phone, d1Message);

        if (sendResult.sent) {
          await d1Ref.set({
            contratoId,
            clienteId: idCliente,
            clienteNome: clientName,
            clienteCpfCnpj: cpfCnpj,
            telefone: phone,
            dataFinalCarencia,
            hasPix: Boolean(firstOpenBoleto?.pix),
            mensagem: d1Message,
            messageId: sendResult.id || null,
            status: "sent",
            enviadoEm: admin.firestore.FieldValue.serverTimestamp(),
          });
          results.push({
            type: "d1",
            contratoId,
            clienteNome: clientName,
            telefone: phone,
            dataFinalCarencia,
            status: "sent",
            messageId: sendResult.id,
          });
        } else {
          await d1Ref.set({
            contratoId,
            clienteId: idCliente,
            clienteNome: clientName,
            telefone: phone,
            dataFinalCarencia,
            status: "error",
            erro: sendResult.error || "Falha no envio da mensagem D-1",
            tentadoEm: admin.firestore.FieldValue.serverTimestamp(),
          });
          results.push({
            type: "d1",
            contratoId,
            clienteNome: clientName,
            status: "failed",
            error: sendResult.error,
          });
        }

        await new Promise((r) => setTimeout(r, 1500));
      }
    }

    return results;
  } catch (error: any) {
    console.error("Erro geral no processador de carências ISPFY:", error);
    throw error;
  }
}

/**
 * Função agendada no Cloud Functions: roda a cada 10 minutos.
 */
export const monitorIspfyCarencia = functions
  .runWith({ timeoutSeconds: 300, memory: "512MB" })
  .pubsub.schedule("every 10 minutes")
  .timeZone("America/Sao_Paulo")
  .onRun(async () => {
    try {
      await processIspfyCarencias();
    } catch (err) {
      console.error("Erro na execução agendada do monitor de carência ISPFY:", err);
    }
    return null;
  });

/**
 * Endpoint HTTP para disparar ou consultar manualmente a verificação de carência:
 * GET/POST /triggerIspfyCarenciaCheck
 */
export const triggerIspfyCarenciaCheck = functions
  .runWith({ timeoutSeconds: 300, memory: "512MB" })
  .https.onRequest(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");

    if (req.method === "OPTIONS") {
      res.status(200).end();
      return;
    }

    try {
      const date = (req.query.date as string) || (req.body?.date as string) || undefined;
      const results = await processIspfyCarencias(date);
      res.status(200).json({
        success: true,
        totalProcessadas: results.length,
        detalhes: results,
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: err.message,
      });
    }
  }
);

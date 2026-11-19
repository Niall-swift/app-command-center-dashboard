import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import axios from "axios";
import { WhapiService } from "./whapiService";
import {
  generatePaymentReceiptImage,
  buildPaymentImageCaption,
  buildReceiptAuthCode,
  ReceiptData,
} from "./receiptGenerator";
import { getIspfyConfig, getWhapiConfig } from "./config/env";

if (admin.apps.length === 0) {
  admin.initializeApp();
}

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  pix: "PIX",
  boleto: "Boleto Bancário",
  carne: "Carnê",
  cartao: "Cartão",
  credito: "Cartão de Crédito",
  debito: "Cartão de Débito",
  dinheiro: "Dinheiro",
  transferencia: "Transferência Bancária",
  ted: "TED",
  doc: "DOC",
};

function extractIspfyRows<T = Record<string, any>>(data: any): T[] {
  if (Array.isArray(data)) return data;
  return data?.data || data?.rows || [];
}

async function fetchIspfyObject<T = Record<string, any>>(
  ispfyHost: string,
  ispfyToken: string,
  path: string,
  params: Record<string, any> = {},
  timeout = 10000
): Promise<T[]> {
  const resp = await axios.get(`${ispfyHost}${path}`, {
    headers: { Token: ispfyToken },
    params: { pagination: "FALSE", ...params },
    timeout,
  });
  return extractIspfyRows<T>(resp.data);
}

async function fetchLookupMap(
  ispfyHost: string,
  ispfyToken: string,
  path: string,
  formatLabel: (row: Record<string, any>) => string
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    const rows = await fetchIspfyObject(ispfyHost, ispfyToken, path, {}, 8000);
    for (const row of rows) {
      if (row?.id != null) {
        const label = formatLabel(row).trim();
        if (label) map.set(String(row.id), label);
      }
    }
  } catch (err: any) {
    console.warn(`Lookup opcional ${path} indisponivel:`, err?.message || err);
  }
  return map;
}

function formatCityRow(row: Record<string, any>): string {
  const name = String(row.nome || row.cidade || row.descricao || "").trim();
  const uf = String(row.uf || row.estado || "").trim();
  if (!name) return "";
  return uf && !name.includes("/") ? `${name}/${uf.toUpperCase()}` : name;
}

function formatCarteiraRow(row: Record<string, any>): string {
  return String(row.descricao || row.nome || row.carteira || row.titulo || "").trim();
}

function parseMoney(value: any): number {
  if (value === null || value === undefined || value === "") return 0;
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatBrl(amount: number): string {
  return amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatIsoDateBr(dateStr: any): string | undefined {
  if (!dateStr) return undefined;
  const raw = String(dateStr).trim().split(" ")[0];
  const parts = raw.split("-");
  if (parts.length !== 3) return raw || undefined;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function buildClientAddress(
  ponto: Record<string, any> | undefined,
  cliente: Record<string, any> | undefined,
  cidadesMap: Map<string, string>
): string | undefined {
  const resolveCity = (cityId: any, cityName: any): string => {
    const mapped = cityId != null ? cidadesMap.get(String(cityId)) : undefined;
    if (mapped) return mapped;
    const raw = String(cityName || "").trim();
    return raw && !/^\d+$/.test(raw) ? raw : "";
  };

  const candidates = [
    ponto && {
      street: ponto.endereco_custom_endereco || ponto.endereco_custom_rua,
      number: ponto.endereco_custom_numero,
      complement: ponto.endereco_custom_complemento,
      neighborhood: ponto.endereco_custom_bairro,
      city: resolveCity(ponto.endereco_custom_id_cidade, ponto.endereco_custom_cidade),
      cep: ponto.endereco_custom_cep,
    },
    ponto && {
      street: ponto.endereco || ponto.rua,
      number: ponto.numero,
      complement: ponto.complemento,
      neighborhood: ponto.bairro,
      city: resolveCity(ponto.id_cidade, ponto.cidade),
      cep: ponto.cep,
    },
    cliente && {
      street: cliente.endereco_cobranca_rua || cliente.endereco || cliente.rua,
      number: cliente.endereco_cobranca_numero || cliente.numero,
      complement: cliente.endereco_cobranca_complemento || cliente.complemento,
      neighborhood: cliente.endereco_cobranca_bairro || cliente.bairro,
      city: resolveCity(
        cliente.endereco_cobranca_id_cidade || cliente.id_cidade,
        cliente.endereco_cobranca_cidade || cliente.cidade
      ),
      cep: cliente.endereco_cobranca_cep || cliente.cep,
    },
  ].filter(Boolean) as Array<Record<string, any>>;

  const pick = (key: string): string => {
    for (const c of candidates) {
      const val = String(c[key] || "").trim();
      if (val) return val;
    }
    return "";
  };

  const primary =
    candidates.find((c) => String(c.street || "").trim()) || candidates[0];
  if (!primary) return undefined;

  const street = String(primary.street || "").trim();
  const number = String(primary.number || "").trim();
  const complement = String(primary.complement || "").trim();
  const neighborhood = String(primary.neighborhood || "").trim() || pick("neighborhood");
  const city = String(primary.city || "").trim() || pick("city");
  const rawCep = (String(primary.cep || "").trim() || pick("cep")).replace(/\D/g, "");
  const cep =
    rawCep.length === 8 ? `${rawCep.slice(0, 5)}-${rawCep.slice(5)}` : "";

  const streetLine = [
    street ? `${street}${number ? `, ${number}` : ""}` : "",
    complement,
  ]
    .filter(Boolean)
    .join(" - ");

  const firstHalf = [streetLine, neighborhood].filter(Boolean).join(", ");
  const full = [firstHalf, city, cep ? `CEP ${cep}` : ""]
    .filter(Boolean)
    .join(" - ");

  return full || undefined;
}

function resolvePaymentMethod(
  cobranca: Record<string, any>,
  carteirasMap: Map<string, string>
): string {
  const rawType = String(
    cobranca.tipo_cobranca || cobranca.forma_pagamento || cobranca.meio_pagamento || ""
  ).trim();
  const typeLabel =
    PAYMENT_TYPE_LABELS[rawType.toLowerCase()] ||
    (rawType ? rawType.charAt(0).toUpperCase() + rawType.slice(1) : "");

  const carteira =
    cobranca.id_carteira != null
      ? carteirasMap.get(String(cobranca.id_carteira)) || ""
      : "";

  if (typeLabel && carteira && !carteira.toLowerCase().includes(typeLabel.toLowerCase())) {
    return `${typeLabel} (${carteira})`;
  }
  return typeLabel || carteira || "Pagamento Confirmado";
}

/**
 * Processa as cobranças pagas do ISPFY para uma data específica (ou hoje).
 * Aplica mutex global por data e trava transacional atômica em `payment_receipts/{cobrancaId}`
 * ANTES de enviar pelo WhatsApp, eliminando envios duplicados por execução paralela ou retry.
 */
export async function processIspfyPayments(customDate?: string) {
  console.log("Iniciando monitoramento de pagamentos ISPFY...");

  const { host: ispfyHost, token: ispfyToken } = getIspfyConfig();
  const { apiKey: whapiApiKey, baseUrl: whapiBaseUrl } = getWhapiConfig();

  const db = admin.firestore();
  const whapiService = new WhapiService(whapiApiKey, whapiBaseUrl);

  const results: any[] = [];
  const runId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // 1. Data alvo no fuso de São Paulo (YYYY-MM-DD)
  const targetDate =
    customDate ||
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
    }).format(new Date());

  const cronLockRef = db.collection("settings").doc(`payment_cron_lock_${targetDate}`);
  let ownsCronLock = false;

  try {
    const lockClaimed = await db.runTransaction(async (tx) => {
      const snap = await tx.get(cronLockRef);
      const data = snap.exists ? snap.data() || {} : {};
      const inProgressUntilMs = Number(data.inProgressUntilMs || 0);
      if (inProgressUntilMs > Date.now()) {
        return false;
      }
      tx.set(
        cronLockRef,
        {
          targetDate,
          lockedByRunId: runId,
          inProgressUntilMs: Date.now() + 3 * 60 * 1000,
          lastStartedAtMs: Date.now(),
        },
        { merge: true }
      );
      return true;
    });

    if (!lockClaimed) {
      console.log(
        `Execucao paralela detectada para ${targetDate} (mutex ativo). Abortando para evitar duplicidade.`
      );
      return results;
    }
    ownsCronLock = true;

    console.log(`Buscando pagamentos para a data: ${targetDate}`);

    // 2. Buscar faturas pagas no ISPFY
    const rawCobrancas = await fetchIspfyObject(
      ispfyHost,
      ispfyToken,
      "/api/object/cliente/contrato/cobranca",
      {
        filter: "status:EQ:pago",
        sort: "data_pagamento:DESC",
        limit: 100,
      },
      20000
    );

    // Filtra apenas as pagas na data alvo
    const cobrancas = rawCobrancas.filter(
      (c: any) => c.data_pagamento && c.data_pagamento.startsWith(targetDate)
    );

    console.log(
      `${cobrancas.length} cobranca(s) paga(s) em ${targetDate} (de ${rawCobrancas.length} analisadas).`
    );

    const [cidadesMap, carteirasMap] =
      cobrancas.length > 0
        ? await Promise.all([
            fetchLookupMap(ispfyHost, ispfyToken, "/api/object/cidade", formatCityRow),
            fetchLookupMap(ispfyHost, ispfyToken, "/api/object/carteira", formatCarteiraRow),
          ])
        : [new Map<string, string>(), new Map<string, string>()];

    for (const cobranca of cobrancas) {
      const cobrancaId = String(cobranca.id);

      if (!cobranca.id_contrato) {
        console.log(`Fatura ${cobrancaId} sem id_contrato. Ignorando.`);
        results.push({ cobrancaId, status: "skipped", reason: "no_contract" });
        continue;
      }

      // 3. Idempotencia transacional atômica - reivindica o lock ANTES de consultar/enviar
      const docRef = db.collection("payment_receipts").doc(cobrancaId);
      const claim = await db.runTransaction(async (tx) => {
        const docSnap = await tx.get(docRef);
        if (docSnap.exists) {
          const existing = docSnap.data() || {};
          if (
            existing.status === "sent" ||
            existing.sucesso === true ||
            Boolean(existing.motivo_skip) ||
            Boolean(existing.whatsappMessageId) ||
            existing.status === "sent_unconfirmed" ||
            existing.status === "uncertain_error" ||
            existing.status === "failed"
          ) {
            return { claimed: false, reason: "already_processed" };
          }
          const lockUntilMs = Number(existing.lockUntilMs || 0);
          if (existing.status === "sending" && lockUntilMs > Date.now()) {
            return { claimed: false, reason: "in_flight_locked" };
          }
        }

        tx.set(
          docRef,
          {
            cobrancaId,
            status: "sending",
            lockUntilMs: Date.now() + 2 * 60 * 1000,
            lockedByRunId: runId,
            lockedAtMs: Date.now(),
          },
          { merge: true }
        );
        return { claimed: true, reason: null };
      });

      if (!claim.claimed) {
        console.log(
          `Fatura ${cobrancaId} ja processada/em andamento (${claim.reason}). Pulando.`
        );
        results.push({ cobrancaId, status: "skipped", reason: claim.reason });
        continue;
      }

      let zapiCallDispatched = false;
      let receiptFinalized = false;

      try {
        // 4. Buscar dados completos do cliente, contrato, contato e ponto de instalacao
        let phone: string | null = null;
        let clientName = "Cliente";
        let id_cliente: string | null = null;
        let contratoData: Record<string, any> | undefined;
        let clienteData: Record<string, any> | undefined;
        let pontoData: Record<string, any> | undefined;

        try {
          // 4.1 Contrato -> id_cliente e dados do plano
          const contratos = await fetchIspfyObject(
            ispfyHost,
            ispfyToken,
            "/api/object/cliente/contrato",
            { filter: `id:EQ:${cobranca.id_contrato}` }
          );
          contratoData = contratos[0];
          id_cliente = contratoData?.id_cliente
            ? String(contratoData.id_cliente)
            : null;

          // 4.2 Ponto de instalacao (nao-fatal se ausente)
          try {
            const pontos = await fetchIspfyObject(
              ispfyHost,
              ispfyToken,
              "/api/object/cliente/contrato/ponto",
              { filter: `id_contrato:EQ:${cobranca.id_contrato}` }
            );
            pontoData = pontos[0];
          } catch (pontoErr: any) {
            console.warn(
              `Ponto de instalacao indisponivel para contrato ${cobranca.id_contrato}:`,
              pontoErr?.message || pontoErr
            );
          }

          if (id_cliente) {
            // 4.3 Cliente + Contato em paralelo
            const [clientes, contatos] = await Promise.all([
              fetchIspfyObject(ispfyHost, ispfyToken, "/api/object/cliente", {
                filter: `id:EQ:${id_cliente}`,
              }),
              fetchIspfyObject(ispfyHost, ispfyToken, "/api/object/cliente/contato", {
                filter: `id_cliente:EQ:${id_cliente}`,
              }),
            ]);

            clienteData = clientes[0];
            clientName =
              clienteData?.nome_razao || clienteData?.nome || clienteData?.razao || "Cliente";

            const validContato = contatos.find(
              (c: any) => c.contato && c.pode_enviar_mensagem !== "n"
            );
            if (validContato) phone = validContato.contato;
          }
        } catch (err: any) {
          console.error(
            `Erro ao buscar cliente/contrato para fatura ${cobrancaId}:`,
            err.message
          );
        }

        if (!phone) {
          console.log(
            `Cliente (id: ${id_cliente}) sem telefone valido. Ignorando fatura ${cobrancaId}.`
          );
          await docRef.set(
            {
              cobrancaId,
              clienteId: id_cliente || null,
              nome: clientName,
              telefone: null,
              status: "skipped",
              motivo_skip: "sem_telefone",
              lockUntilMs: null,
              enviadoEm: admin.firestore.FieldValue.serverTimestamp(),
              sucesso: false,
            },
            { merge: true }
          );
          receiptFinalized = true;
          results.push({ cobrancaId, status: "skipped", reason: "no_valid_phone" });
          continue;
        }

        // 5. Montar dados completos do comprovante
        const valorPagoNum = parseMoney(cobranca.valor_pago || cobranca.valor);
        const valorOriginalNum = parseMoney(cobranca.valor);
        const descontoNum = parseMoney(cobranca.desconto);
        const acrescimoNum = parseMoney(cobranca.juros) + parseMoney(cobranca.multa);
        const hasAdjustment =
          descontoNum > 0 ||
          acrescimoNum > 0 ||
          (valorOriginalNum > 0 && Math.abs(valorOriginalNum - valorPagoNum) > 0.009);

        const [datePart, timePart] = (cobranca.data_pagamento || "").split(" ");
        const dataFormatada = formatIsoDateBr(datePart) || "";
        const horaFormatada = timePart ? timePart.substring(0, 5) : "00:00";

        const baseReceiptData: ReceiptData = {
          clientName,
          valor: formatBrl(valorPagoNum),
          data: dataFormatada,
          hora: horaFormatada,
          descricao:
            cobranca.descricao ||
            cobranca.referencia ||
            contratoData?.plano ||
            "Mensalidade de Internet",
          cobrancaId,
          cpfCnpj:
            clienteData?.cpf_cnpj ||
            clienteData?.cnpj_cpf ||
            clienteData?.cpf ||
            clienteData?.cnpj ||
            undefined,
          telefone: phone,
          endereco: buildClientAddress(pontoData, clienteData, cidadesMap),
          plano: contratoData?.plano || contratoData?.descricao || undefined,
          contratoId: String(cobranca.id_contrato),
          vencimento: formatIsoDateBr(cobranca.data_vencimento),
          formaPagamento: resolvePaymentMethod(cobranca, carteirasMap),
          valorOriginal:
            hasAdjustment && valorOriginalNum > 0 ? formatBrl(valorOriginalNum) : undefined,
          desconto: descontoNum > 0 ? formatBrl(descontoNum) : undefined,
          acrescimo: acrescimoNum > 0 ? formatBrl(acrescimoNum) : undefined,
          nossoNumero: cobranca.nosso_numero
            ? String(cobranca.nosso_numero).trim()
            : undefined,
        };
        const authCode = buildReceiptAuthCode(baseReceiptData);
        const receiptData: ReceiptData = { ...baseReceiptData, authCode };

        console.log(
          `Enviando comprovante para ${clientName} (${phone}) - Fatura ${cobrancaId} [${authCode}]`
        );

        // 6. Tenta Canvas -> imagem -> fallback texto (apenas se nao foi timeout HTTP)
        let sendResult: { sent: boolean; id?: string; error?: string; timeout?: boolean };
        let enviadoComoImagem = false;

        const imageBase64 = await generatePaymentReceiptImage(receiptData);

        if (imageBase64) {
          // 6a. Canvas ok -> tenta enviar como imagem via Z-API /send-image
          const caption = buildPaymentImageCaption(clientName, receiptData);
          zapiCallDispatched = true;
          sendResult = await whapiService.sendPaymentReceiptImage(
            phone,
            imageBase64,
            caption
          );
          if (sendResult.sent) {
            enviadoComoImagem = true;
          } else if (sendResult.timeout) {
            console.warn(
              `Timeout no /send-image da Fatura ${cobrancaId}; fallback em texto bloqueado para evitar duplicidade.`
            );
          } else {
            // Z-API rejeitou a imagem explicitamente (nao timeout) -> fallback texto
            console.warn(
              `Envio de imagem rejeitado (${sendResult.error}). Enviando texto...`
            );
            sendResult = await whapiService.sendPaymentReceipt(
              clientName,
              phone,
              receiptData
            );
          }
        } else {
          // 6b. Canvas falhou -> texto direto
          zapiCallDispatched = true;
          sendResult = await whapiService.sendPaymentReceipt(
            clientName,
            phone,
            receiptData
          );
        }

        const finalStatus = sendResult.sent
          ? "sent"
          : sendResult.timeout
          ? "sent_unconfirmed"
          : "failed";

        // 7. Finalizar resultado no Firestore liberando lockUntilMs
        await docRef.set(
          {
            cobrancaId,
            clienteId: id_cliente || null,
            nome: clientName,
            telefone: phone,
            endereco: receiptData.endereco || null,
            authCode,
            valor: receiptData.valor,
            dataPagamento: cobranca.data_pagamento,
            enviadoComoImagem,
            status: finalStatus,
            whatsappMessageId: sendResult.id || null,
            lockUntilMs: null,
            enviadoEm: admin.firestore.FieldValue.serverTimestamp(),
            sucesso: sendResult.sent,
            erro: sendResult.error || null,
          },
          { merge: true }
        );
        receiptFinalized = true;

        console.log(
          `${sendResult.sent ? "OK" : "FALHOU"} Fatura ${cobrancaId}: ${
            sendResult.sent
              ? `comprovante enviado como ${enviadoComoImagem ? "imagem" : "texto"}`
              : sendResult.error
          }`
        );

        results.push({
          cobrancaId,
          clientName,
          phone,
          enviadoComoImagem,
          sucesso: sendResult.sent,
          erro: sendResult.error || null,
        });

        // Rate limit suave entre envios (1.2s)
        await new Promise((r) => setTimeout(r, 1200));
      } catch (invoiceErr: any) {
        if (!receiptFinalized) {
          if (!zapiCallDispatched) {
            await docRef.delete().catch(() => undefined);
          } else {
            await docRef
              .set(
                {
                  status: "uncertain_error",
                  lockUntilMs: null,
                  sucesso: false,
                  erro: invoiceErr?.message || "Erro apos disparo ao Z-API",
                },
                { merge: true }
              )
              .catch(() => undefined);
          }
        }
        throw invoiceErr;
      }
    }
  } catch (error: any) {
    console.error(
      "Erro fatal no monitoramento:",
      error.response?.data || error.message
    );
    throw error;
  } finally {
    if (ownsCronLock) {
      await cronLockRef
        .set(
          {
            inProgressUntilMs: 0,
            lastFinishedAtMs: Date.now(),
          },
          { merge: true }
        )
        .catch(() => undefined);
    }
  }

  return results;
}

/**
 * Funcao agendada oficial que roda a cada 10 minutos.
 */
export const monitorIspfyPayments = functions
  .runWith({ memory: "512MB", timeoutSeconds: 180 })
  .pubsub.schedule("every 10 minutes")
  .timeZone("America/Sao_Paulo")
  .onRun(async () => {
    try {
      await processIspfyPayments();
    } catch (err) {
      console.error("Erro na execucao agendada do monitor ISPFY:", err);
    }
    return null;
  });

/**
 * Endpoint HTTP para disparar a verificacao manualmente quando desejar.
 * GET /triggerIspfyPaymentCheck?date=2026-10-21
 */
export const triggerIspfyPaymentCheck = functions.https.onRequest(
  async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");

    if (req.method === "OPTIONS") {
      res.status(200).end();
      return;
    }

    try {
      const date = (req.query.date as string) || undefined;
      const results = await processIspfyPayments(date);
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

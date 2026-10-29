import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import axios from "axios";
import { WhapiService } from "./whapiService";
import {
  generatePaymentReceiptImage,
  buildPaymentTextFallback,
  ReceiptData,
} from "./receiptGenerator";

if (admin.apps.length === 0) {
  admin.initializeApp();
}

/**
 * Processa as cobranças pagas do ISPFY para uma data específica (ou hoje).
 */
export async function processIspfyPayments(customDate?: string) {
  console.log("Iniciando monitoramento de pagamentos ISPFY...");

  const ispfyHost =
    process.env.ISPFY_HOST ||
    process.env.ISPFY_URL ||
    "http://avltelecom.ispfycloud.com.br:8020";
  const ispfyToken =
    process.env.ISPFY_TOKEN || "815e74b02bc6faa371f29274e3d317e0";
  const whapiApiKey =
    process.env.WHAPI_KEY ||
    process.env.WHAPI_API_KEY ||
    process.env.ZAPI_CLIENT_TOKEN ||
    "Fa64a52f41c274de0847cf445392dbeedS";
  const whapiBaseUrl =
    process.env.WHAPI_BASE_URL ||
    "https://api.z-api.io/instances/3F95A6BAE5232173E9473AA12C97C203/token/FC515FBAF1E892D0F1E3FFAB";

  const db = admin.firestore();
  const whapiService = new WhapiService(whapiApiKey, whapiBaseUrl);

  const results: any[] = [];

  try {
    // 1. Data alvo no fuso de São Paulo (YYYY-MM-DD)
    const targetDate =
      customDate ||
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Sao_Paulo",
      }).format(new Date());

    console.log(`Buscando pagamentos para a data: ${targetDate}`);

    // 2. Buscar faturas pagas no ISPFY
    const response = await axios.get(
      `${ispfyHost}/api/object/cliente/contrato/cobranca`,
      {
        headers: { Token: ispfyToken },
        params: {
          filter: "status:EQ:pago",
          sort: "data_pagamento:DESC",
          limit: 100,
          pagination: "FALSE",
        },
        timeout: 20000,
      }
    );

    const rawCobrancas = Array.isArray(response.data)
      ? response.data
      : response.data?.data || response.data?.rows || [];

    // Filtra apenas as pagas na data alvo
    const cobrancas = rawCobrancas.filter(
      (c: any) => c.data_pagamento && c.data_pagamento.startsWith(targetDate)
    );

    console.log(
      `${cobrancas.length} cobranca(s) paga(s) em ${targetDate} (de ${rawCobrancas.length} analisadas).`
    );

    for (const cobranca of cobrancas) {
      const cobrancaId = String(cobranca.id);

      // 3. Idempotencia - pula se ja processamos essa fatura
      const docRef = db.collection("payment_receipts").doc(cobrancaId);
      const docSnap = await docRef.get();
      if (docSnap.exists) {
        console.log(`Fatura ${cobrancaId} ja processada anteriormente. Pulando.`);
        results.push({ cobrancaId, status: "skipped", reason: "already_processed" });
        continue;
      }

      if (!cobranca.id_contrato) {
        console.log(`Fatura ${cobrancaId} sem id_contrato. Ignorando.`);
        results.push({ cobrancaId, status: "skipped", reason: "no_contract" });
        continue;
      }

      // 4. Buscar nome + telefone do cliente
      let phone: string | null = null;
      let clientName = "Cliente";
      let id_cliente: string | null = null;

      try {
        // 4.1 Contrato -> id_cliente
        const contratoResp = await axios.get(
          `${ispfyHost}/api/object/cliente/contrato`,
          {
            headers: { Token: ispfyToken },
            params: {
              filter: `id:EQ:${cobranca.id_contrato}`,
              pagination: "FALSE",
            },
            timeout: 10000,
          }
        );
        const contratos = Array.isArray(contratoResp.data)
          ? contratoResp.data
          : contratoResp.data?.data || contratoResp.data?.rows || [];
        id_cliente = contratos[0]?.id_cliente
          ? String(contratos[0].id_cliente)
          : null;

        if (id_cliente) {
          // 4.2 Cliente -> nome
          const clientResp = await axios.get(
            `${ispfyHost}/api/object/cliente`,
            {
              headers: { Token: ispfyToken },
              params: { filter: `id:EQ:${id_cliente}`, pagination: "FALSE" },
              timeout: 10000,
            }
          );
          const clientes = Array.isArray(clientResp.data)
            ? clientResp.data
            : clientResp.data?.data || clientResp.data?.rows || [];
          clientName =
            clientes[0]?.nome_razao || clientes[0]?.nome || "Cliente";

          // 4.3 Contato -> telefone
          const contatoResp = await axios.get(
            `${ispfyHost}/api/object/cliente/contato`,
            {
              headers: { Token: ispfyToken },
              params: {
                filter: `id_cliente:EQ:${id_cliente}`,
                pagination: "FALSE",
              },
              timeout: 10000,
            }
          );
          const contatos = Array.isArray(contatoResp.data)
            ? contatoResp.data
            : contatoResp.data?.data || contatoResp.data?.rows || [];
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
        await docRef.set({
          cobrancaId,
          clienteId: id_cliente || null,
          nome: clientName,
          telefone: null,
          motivo_skip: "sem_telefone",
          enviadoEm: admin.firestore.FieldValue.serverTimestamp(),
          sucesso: false,
        });
        results.push({ cobrancaId, status: "skipped", reason: "no_valid_phone" });
        continue;
      }

      // 5. Montar dados do comprovante
      const valorPago = parseFloat(
        cobranca.valor_pago || cobranca.valor || "0"
      ).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

      const [datePart, timePart] = (cobranca.data_pagamento || "").split(" ");
      const dataFormatada = (datePart || "").split("-").reverse().join("/");
      const horaFormatada = timePart ? timePart.substring(0, 5) : "00:00";

      const receiptData: ReceiptData = {
        clientName,
        valor: valorPago,
        data: dataFormatada,
        hora: horaFormatada,
        descricao: cobranca.descricao || "Mensalidade de Internet",
        cobrancaId,
      };

      console.log(
        `Enviando comprovante para ${clientName} (${phone}) - Fatura ${cobrancaId}`
      );

      // 6. Tenta Canvas -> imagem -> fallback texto
      let sendResult: { sent: boolean; id?: string; error?: string };
      let enviadoComoImagem = false;

      const imageBase64 = await generatePaymentReceiptImage(receiptData);

      if (imageBase64) {
        // 6a. Canvas ok -> tenta enviar como imagem via Z-API /send-image
        const caption = buildPaymentTextFallback(clientName, receiptData);
        sendResult = await whapiService.sendPaymentReceiptImage(
          phone,
          imageBase64,
          caption
        );
        if (sendResult.sent) {
          enviadoComoImagem = true;
        } else {
          // Z-API rejeitou a imagem -> fallback texto
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
        sendResult = await whapiService.sendPaymentReceipt(
          clientName,
          phone,
          receiptData
        );
      }

      // 7. Salvar resultado no Firestore
      await docRef.set({
        cobrancaId,
        clienteId: id_cliente || null,
        nome: clientName,
        telefone: phone,
        valor: receiptData.valor,
        dataPagamento: cobranca.data_pagamento,
        enviadoComoImagem,
        enviadoEm: admin.firestore.FieldValue.serverTimestamp(),
        sucesso: sendResult.sent,
        erro: sendResult.error || null,
      });

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
    }
  } catch (error: any) {
    console.error(
      "Erro fatal no monitoramento:",
      error.response?.data || error.message
    );
    throw error;
  }

  return results;
}

/**
 * Funcao agendada que roda a cada 10 minutos.
 */
export const monitorIspfyPayments = functions.pubsub
  .schedule("every 10 minutes")
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

import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import axios from "axios";
import * as https from "https";
import { WhapiService } from "./whapiService";

if (admin.apps.length === 0) {
  admin.initializeApp();
}

const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
});

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

  // Formatar data caso venha em YYYY-MM-DD
  let dataFormatada = dataCarencia;
  if (/^\d{4}-\d{2}-\d{2}/.test(dataCarencia)) {
    const parts = dataCarencia.split(" ")[0].split("-");
    if (parts.length === 3) {
      dataFormatada = `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
  }

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
 * Processa todos os contratos em carência no ISPFY e dispara WhatsApp para os não notificados.
 */
export async function processIspfyCarencias(targetDate?: string) {
  console.log("Iniciando monitoramento de carências ISPFY...");

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
    const today =
      targetDate ||
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Sao_Paulo",
      }).format(new Date());

    console.log(`Buscando contratos em carência (referência: ${today})...`);

    // 1. Buscar contratos com data_final_carencia preenchida
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

    // Filtra APENAS contratos cuja carência foi concedida NO DIA ATUAL (today)
    // Exatamente como o monitor de pagamentos só notifica faturas pagas no dia atual
    const contratos = rawContratos.filter((c: any) => {
      const ultimaCarencia = extractDateOnly(c.data_ultima_carencia);
      const finalDate = extractDateOnly(c.data_final_carencia);

      // Deve ter sido concedida na data alvo (hoje) e ter prazo final válido
      const foiConcedidaHoje = ultimaCarencia === today;
      const temFinalValido = finalDate && finalDate !== "0000-00-00" && finalDate >= today;

      return foiConcedidaHoje && temFinalValido;
    });

    console.log(
      `${contratos.length} contrato(s) com carência concedida em ${today} (de ${rawContratos.length} contratos analisados no ISPFY).`
    );

    for (const contrato of contratos) {
      const contratoId = String(contrato.id);
      const dataFinalCarencia = extractDateOnly(contrato.data_final_carencia);
      const idCliente = contrato.id_cliente ? String(contrato.id_cliente) : null;

      if (!dataFinalCarencia) continue;

      // Chave única para este agendamento específico de carência
      const notificationDocId = `${contratoId}_${dataFinalCarencia}`;
      const docRef = db.collection("carencia_notifications").doc(notificationDocId);
      const docSnap = await docRef.get();

      if (docSnap.exists) {
        console.log(`Carência do contrato ${contratoId} (${dataFinalCarencia}) já notificada. Pulando.`);
        results.push({
          contratoId,
          dataFinalCarencia,
          status: "skipped",
          reason: "already_notified",
        });
        continue;
      }

      // Buscar nome do cliente e contatos
      let clientName = "Cliente";
      let phone: string | null = null;
      let cpfCnpj: string | null = null;

      if (idCliente) {
        try {
          // Busca dados do cliente
          const clientResp = await axios.get(
            `${ispfyHost}/api/object/cliente`,
            {
              headers: { Token: ispfyToken },
              params: { filter: `id:EQ:${idCliente}`, pagination: "FALSE" },
              timeout: 10000,
              httpsAgent,
            }
          );
          const clientes = Array.isArray(clientResp.data)
            ? clientResp.data
            : clientResp.data?.data || clientResp.data?.rows || [];
          if (clientes.length > 0) {
            clientName = clientes[0]?.nome_razao || clientes[0]?.nome || "Cliente";
            cpfCnpj = clientes[0]?.cpf_cnpj || clientes[0]?.cnpj_cpf || null;
            if (clientes[0]?.fone_whatsapp) {
              phone = clientes[0].fone_whatsapp;
            } else if (clientes[0]?.fone_celular) {
              phone = clientes[0].fone_celular;
            }
          }

          // Se não encontrou telefone no cliente, busca na tabela de contatos
          if (!phone) {
            const contatoResp = await axios.get(
              `${ispfyHost}/api/object/cliente/contato`,
              {
                headers: { Token: ispfyToken },
                params: {
                  filter: `id_cliente:EQ:${idCliente}`,
                  pagination: "FALSE",
                },
                timeout: 10000,
                httpsAgent,
              }
            );
            const contatos = Array.isArray(contatoResp.data)
              ? contatoResp.data
              : contatoResp.data?.data || contatoResp.data?.rows || [];
            const validContato = contatos.find(
              (ct: any) => ct.contato && ct.pode_enviar_mensagem !== "n"
            );
            if (validContato) {
              phone = validContato.contato;
            }
          }
        } catch (err: any) {
          console.error(`Erro ao buscar dados do cliente ${idCliente}:`, err.message);
        }
      }

      if (!phone) {
        console.log(`Cliente ${idCliente} sem telefone válido para contrato ${contratoId}.`);
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
        results.push({
          contratoId,
          clienteId: idCliente,
          status: "skipped",
          reason: "no_phone",
        });
        continue;
      }

      // Montar mensagem e disparar
      const messageBody = buildCarenciaMessage(clientName, dataFinalCarencia);
      console.log(`Enviando mensagem de carência para ${clientName} (${phone}) - Contrato ${contratoId}`);

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
          contratoId,
          clienteNome: clientName,
          telefone: phone,
          dataFinalCarencia,
          status: "sent",
          messageId: sendResult.id,
        });
        console.log(`✅ Notificação de carência enviada com sucesso para ${clientName}!`);
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

        results.push({
          contratoId,
          clienteNome: clientName,
          status: "failed",
          error: sendResult.error,
        });
        console.error(`❌ Falha ao enviar para ${clientName}:`, sendResult.error);
      }

      // Intervalo de segurança anti-ban entre disparos (1.5 segundos)
      await new Promise((r) => setTimeout(r, 1500));
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

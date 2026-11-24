import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import {ClientData, WelcomeMessageLog} from "./types";
import { IspfyBackendService } from "./ispfyBackendService";
import { runJosueChat } from "./aiProxy";
import { AiService } from "./services/aiService";
import { WhatsAppService } from "./services/whatsappService";
import { WhapiService } from "./whapiService";
import { generateRaffleTicketImage } from "./receiptGenerator";
import {
  buildBrPhoneVariants,
  indexZapiMessageForTracking,
  sanitizeIndexKey,
} from "./zapiSuite";
import axios from "axios";
import * as https from "https";
import { verifyAuth } from "./config/auth";
import { getIspfyConfig, getIxcConfig, getWhapiConfig } from "./config/env";

// Inicializar Firebase Admin
if (admin.apps.length === 0) {
  admin.initializeApp();
}
const db = admin.firestore();

/**
 * Cloud Function que dispara quando um novo cliente se cadastra no sorteio
 * Envia automaticamente uma mensagem de boas-vindas via WhatsApp
 */
export const onNewRaffleRegistration = functions.firestore
  .document("usuariosDoPreMix/{userId}")
  .onCreate(async (snapshot, context) => {
    const userId = context.params.userId;
    const clientData = snapshot.data() as ClientData;

    console.log("🎉 Novo cadastro detectado:", {
      userId,
      name: clientData.name || clientData.nome,
      phone: clientData.whatsapp || clientData.phone,
    });

    // Verificar se já foi enviada mensagem (evitar duplicatas)
    if (snapshot.get("mensagem_enviada")) {
      console.log("⚠️ Mensagem já foi enviada anteriormente. Ignorando.");
      return null;
    }

    // Configurações via Firebase Functions Config
    let whapiApiKey = "";
    let whapiBaseUrl = "";
    try {
      const cfg = getWhapiConfig();
      whapiApiKey = cfg.apiKey;
      whapiBaseUrl = cfg.baseUrl;
    } catch {
      whapiApiKey = "";
    }

    if (!whapiApiKey) {
      console.error("❌ WHAPI_KEY / WHAPI_API_KEY não configurado!");
      await updateClientWithError(
        userId,
        "Configuração de API não encontrada"
      );
      return null;
    }

    // Extrair dados do cliente
    const clientName = clientData.name || clientData.nome || "Cliente";
    const clientPhone = clientData.whatsapp || clientData.phone;

    if (!clientPhone) {
      console.error("❌ Cliente não possui telefone cadastrado");
      await updateClientWithError(userId, "Telefone não cadastrado");
      return null;
    }

    try {
      // Enviar mensagem de boas-vindas via WhapiService com imagem/template
      const whapiService = new WhapiService(whapiApiKey, whapiBaseUrl);
      const result = await whapiService.sendWelcomeMessage(
        clientName,
        clientPhone
      );

      // Criar log de envio
      const log: WelcomeMessageLog = {
        clientId: userId,
        clientName: clientName,
        phone: clientPhone,
        status: result.sent ? "success" : "failed",
        error: result.error,
        messageId: result.id,
        timestamp: new Date().toISOString(),
      };

      // Salvar log no Firestore
      await admin.firestore()
        .collection("welcome_message_logs")
        .add(log);

      // Atualizar documento do cliente
      if (result.sent) {
        await snapshot.ref.update({
          mensagem_enviada: true,
          mensagem_enviada_em: admin.firestore.FieldValue.serverTimestamp(),
          mensagem_id: result.id,
        });

        console.log("✅ Mensagem de boas-vindas enviada com sucesso!");
      } else {
        await snapshot.ref.update({
          mensagem_enviada: false,
          mensagem_erro: result.error,
          mensagem_tentativa_em:
            admin.firestore.FieldValue.serverTimestamp(),
        });

        console.error("❌ Falha ao enviar mensagem:", result.error);
      }

      return log;
    } catch (error) {
      console.error("❌ Erro ao processar cadastro:", error);
      await updateClientWithError(
        userId,
        error instanceof Error ? error.message : "Erro desconhecido"
      );
      return null;
    }
  });

async function updateClientWithError(
  userId: string,
  errorMessage: string
): Promise<void> {
  try {
    await admin.firestore()
      .collection("usuariosDoPreMix")
      .doc(userId)
      .update({
        mensagem_enviada: false,
        mensagem_erro: errorMessage,
        mensagem_tentativa_em: admin.firestore.FieldValue.serverTimestamp(),
      });
  } catch (error) {
    console.error("Erro ao atualizar documento:", error);
  }
}

async function handleAppUninstall(userId: string, token: string, userData: any) {
  try {
    console.log(`🗑️ Token inválido detectado para o usuário ${userId}. Limpando fcmToken e enviando WhatsApp...`);
    
    // 1. Remove o fcmToken do banco de dados
    const userRef = admin.firestore().collection("users").doc(userId);
    await userRef.update({ fcmToken: admin.firestore.FieldValue.delete() });

    if (userData?.cpf || userData?.cnpj_cpf) {
      const cpf = (userData.cpf || userData.cnpj_cpf).replace(/\D/g, "");
      const cpfRef = admin.firestore().collection("users").doc(cpf);
      const cpfDoc = await cpfRef.get();
      if (cpfDoc.exists && cpfDoc.data()?.fcmToken === token) {
        await cpfRef.update({ fcmToken: admin.firestore.FieldValue.delete() });
      }
    }

    // 2. Enviar mensagem via Whapi avisando sobre exclusão
    const phone = userData?.whatsapp || userData?.telefone_celular || userData?.phone;
    const name = userData?.nome || userData?.name || "Cliente";

    if (phone) {
      const { apiKey: whapiApiKey, baseUrl: whapiBaseUrl } = getWhapiConfig();
      const message = `Olá ${name},\n\nIdentificamos que o App AVL Telecom foi removido do seu dispositivo. 😔\n\nPor causa disso, *você não está mais elegível para participar dos sorteios do Pre-mix*. 🎁\n\nPara voltar a concorrer, reinstale o aplicativo e mantenha-o no seu celular!`;

      let formattedPhone = phone.replace(/\D/g, "");
      if (!formattedPhone.startsWith("55")) formattedPhone = "55" + formattedPhone;

      await axios.post(`${whapiBaseUrl.replace(/\/$/, "")}/send-text`, {
        phone: formattedPhone,
        message: message
      }, {
        headers: {
          "Content-Type": "application/json",
          "Client-Token": whapiApiKey
        }
      });
      console.log(`✅ Aviso de desinstalação enviado com sucesso para ${formattedPhone}`);
    } else {
      console.log(`ℹ️ Usuário ${userId} não tem telefone salvo. WhatsApp de desinstalação ignorado.`);
    }
  } catch (err: any) {
    console.error("❌ Erro ao tratar desinstalação:", err.message);
  }
}

/**
 * ⏰ Tarefa Agendada: Verificação Diária de Faturas
 * Roda todos os dias às 08:00 AM
 */
function parseInvoiceDateMs(rawDate?: string | null): number | null {
  if (!rawDate) return null;
  const clean = String(rawDate).trim().split(" ")[0];
  let iso = clean;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(clean)) {
    const [d, m, y] = clean.split("/");
    iso = `${y}-${m}-${d}`;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [year, month, day] = iso.split("-").map(Number);
  return Date.UTC(year, (month || 1) - 1, day || 1);
}

/**
 * Núcleo compartilhado para envio de Push FCM (D-2, D-1, D0, D+1..15) consultando faturas no ISPFY.
 */
async function executePushDueInvoicesCheck(cleanupInvalidTokens: boolean): Promise<number> {
  const usersRef = admin.firestore().collection("users");
  const querySnapshot = await usersRef.where("fcmToken", "!=", null).get();

  if (querySnapshot.empty) {
    console.log("ℹ️ Nenhum usuário com token FCM encontrado.");
    return 0;
  }

  const { host: ispfyHost, token: ispfyToken } = getIspfyConfig();
  const ispfy = new IspfyBackendService(ispfyHost, ispfyToken);

  const todayIso = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
  const todayMs = parseInvoiceDateMs(todayIso) ?? Date.now();
  const msPerDay = 1000 * 60 * 60 * 24;

  const notifications: Promise<any>[] = [];

  for (const userDoc of querySnapshot.docs) {
    const userData = userDoc.data();
    const userId = userDoc.id;
    const fcmToken = userData.fcmToken;
    const cpf = userData.cpf || userData.cnpj_cpf;
    const clientIdCandidate = userData.ispfyId || userData.clientId || userId;

    try {
      let cliente: any = null;
      if (cpf) {
        cliente = await ispfy.buscarClientePorDocumento(String(cpf));
      }
      if (!cliente && clientIdCandidate && /^\d+$/.test(String(clientIdCandidate))) {
        cliente = await ispfy.buscarClientePorId(String(clientIdCandidate));
      }

      if (!cliente?.id) continue;

      const invoices = await ispfy.buscarFaturasAbertasPorCliente(cliente.id);

      for (const inv of invoices) {
        if (inv.data_pagamento || String(inv.status || "").toLowerCase() === "cancelado") continue;
        const dueMs = parseInvoiceDateMs(inv.data_vencimento);
        if (dueMs === null) continue;

        const diffDays = Math.round((dueMs - todayMs) / msPerDay);

        let shouldNotify = false;
        let title = "⚠️ Fatura AVL";
        let body = "";
        let color = "#F59E0B";

        if (diffDays === 1 || diffDays === 2) {
          shouldNotify = true;
          title = "⏰ Lembrete de Fatura";
          body = `Sua fatura de R$ ${inv.valor} vence em ${diffDays} dia(s) (${inv.data_vencimento}).`;
        } else if (diffDays === 0) {
          shouldNotify = true;
          title = "🚨 Vence HOJE";
          body = `Sua fatura de R$ ${inv.valor} vence hoje! Pague agora para evitar interrupções.`;
          color = "#EF4444";
        } else if (diffDays < 0 && diffDays >= -15) {
          shouldNotify = true;
          title = "🚫 Fatura Vencida";
          body = `Sua fatura de R$ ${inv.valor} está vencida há ${Math.abs(diffDays)} dia(s). Regularize agora!`;
          color = "#B91C1C";
        }

        if (shouldNotify) {
          const message = {
            notification: { title, body },
            data: {
              type: "invoice_reminder",
              screen: "Boletos",
              invoiceId: String(inv.id),
              valor: String(inv.valor || ""),
            },
            android: {
              priority: "high" as any,
              notification: {
                channelId: "alerts",
                color,
              },
            },
            token: fcmToken,
          };

          notifications.push(
            admin.messaging().send(message).catch((e) => {
              console.error(`Erro ao notificar token ${fcmToken}:`, e.message);
              if (
                cleanupInvalidTokens &&
                (e.code === "messaging/registration-token-not-registered" ||
                  e.code === "messaging/invalid-registration-token")
              ) {
                handleAppUninstall(userId, fcmToken, userData);
              }
            })
          );
        }
      }
    } catch (userError: any) {
      console.error(`❌ Erro ao verificar faturas ISPFY para usuário ${userId}:`, userError.message);
    }
  }

  await Promise.all(notifications);
  return notifications.length;
}

export const checkDueInvoices = functions.pubsub
  .schedule("0 8 * * *")
  .timeZone("America/Sao_Paulo")
  .onRun(async () => {
    console.log("⏰ Iniciando verificação diária de faturas via ISPFY...");
    try {
      const total = await executePushDueInvoicesCheck(true);
      console.log(`✅ Verificação diária concluída. Enviadas ${total} notificações.`);
      return null;
    } catch (error) {
      console.error("❌ Erro global no checkDueInvoices:", error);
      return null;
    }
  });

/**
 * 🧪 Função de Teste: Disparo Manual via HTTP
 */
export const testPush = functions.https.onRequest(async (req, res) => {
  const userId = req.query.userId as string;
  const cpf = req.query.cpf as string;
  const force = req.query.force === "true";

  if (!userId && !cpf) {
    res.status(400).send("Informe o userId ou o cpf na URL (ex: ?cpf=123.456.789-00)");
    return;
  }

  try {
    let userData: any = null;
    let finalUserId = userId;

    // 1. Localizar Usuário no Firestore
    if (cpf) {
      const cpfNumbers = cpf.replace(/\D/g, "");
      const querySnapshot = await admin.firestore().collection("users")
        .where("cpf", "in", [cpf, cpfNumbers])
        .limit(1)
        .get();
      
      if (querySnapshot.empty) {
        res.status(404).send(`Usuário com CPF ${cpf} não encontrado no Firestore`);
        return;
      }
      userData = querySnapshot.docs[0].data();
      finalUserId = querySnapshot.docs[0].id;
    } else {
      const userDoc = await admin.firestore().collection("users").doc(userId).get();
      if (!userDoc.exists) {
        res.status(404).send(`Usuário com ID ${userId} não encontrado`);
        return;
      }
      userData = userDoc.data();
    }

    if (!userData?.fcmToken) {
      res.status(404).send(`Usuário ${finalUserId} encontrado, mas NÃO possui fcmToken salvo.`);
      return;
    }

    const token = userData.fcmToken;
    const ixcId = userData.clientId || finalUserId; // Prioriza o campo clientId
    const { token: IXC_TOKEN } = getIxcConfig();
    const auth = Buffer.from(IXC_TOKEN).toString("base64");

    // 2. Consultar IXC API (Busca aberta para diagnóstico)
    const response = await axios.post(
      "https://coopertecisp.com.br/webservice/v1/fn_areceber",
      {
        qtype: "fn_areceber.id_cliente",
        query: ixcId,
        oper: "=",
        page: "1",
        rp: "50",
        sortname: "fn_areceber.data_vencimento",
        sortorder: "asc",
      },
      {
        headers: {Authorization: `Basic ${auth}`, ixcsoft: "listar"},
        timeout: 10000,
      }
    );

    const invoices = response.data?.registros || [];
    let notificationSent = false;

    // 3. Processar Faturas
    console.log(`🔍 Faturas encontradas no IXC: ${invoices.length}`);

    for (const inv of invoices) {
      // Ignorar se não estiver aberta
      if (inv.status !== "A") continue;

      // Suporta YYYY-MM-DD (vinda do IXC) ou DD/MM/YYYY
      let dueDate: Date;
      if (inv.data_vencimento.includes("-")) {
        const [year, month, day] = inv.data_vencimento.split("-");
        dueDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      } else {
        const [day, month, year] = inv.data_vencimento.split("/");
        dueDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const diffTime = dueDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      console.log(`📅 Analisando Fatura ID ${inv.id}: Vencimento ${inv.data_vencimento} | DiffDays: ${diffDays}`);

      let shouldNotify = false;
      let title = "⚠️ Fatura AVL";
      let body = "";
      let color = "#F59E0B"; // Laranja (Padrão)

      if (diffDays === 1 || diffDays === 2) {
        shouldNotify = true;
        title = "⏰ Lembrete de Fatura";
        body = `Sua fatura de R$ ${inv.valor} vence em ${diffDays} dia(s) (${inv.data_vencimento}).`;
      } else if (diffDays === 0) {
        shouldNotify = true;
        title = "🚨 Vence HOJE";
        body = `Sua fatura de R$ ${inv.valor} vence hoje! Pague agora para evitar interrupções.`;
        color = "#EF4444"; // Vermelho
      } else if (diffDays < 0 && diffDays >= -15) { // Até 15 dias de atraso
        shouldNotify = true;
        title = "🚫 Fatura Vencida";
        body = `Sua fatura de R$ ${inv.valor} está vencida há ${Math.abs(diffDays)} dia(s). Regularize agora!`;
        color = "#B91C1C"; // Vermelho Escuro
      }

      // Se for para notificar OU se o force for true
      if (shouldNotify || (force && !notificationSent)) {
        const finalTitle = shouldNotify ? title : "🧪 Teste de Notificação";
        const finalBody = shouldNotify ? body : `Fatura teste de R$ ${inv.valor} (${inv.data_vencimento}).`;

        const message = {
          notification: {
            title: finalTitle,
            body: finalBody,
          },
          data: {
            type: "invoice_reminder",
            screen: "Boletos",
            invoiceId: inv.id,
            valor: inv.valor,
          },
          android: {
            priority: "high" as any,
            notification: {
              channelId: "alerts",
              color: color,
            },
          },
          token: token,
        };
        await admin.messaging().send(message);
        notificationSent = true;
        break;
      }
    }

    if (notificationSent) {
      res.send(`✅ Notificação IXC enviada com sucesso para ${userData.name || userData.razao} (ID: ${finalUserId})`);
    } else if (force) {
      // Se não tem faturas mas forçou o teste
      const message = {
        notification: {
          title: "💳 Teste Forçado: Fatura",
          body: "Esta é uma notificação de teste forçada (sem faturas reais no IXC).",
        },
        data: { type: "invoice_reminder", screen: "Boletos" },
        android: { priority: "high" as any, notification: { channelId: "alerts", color: "#F59E0B" } },
        token: token,
      };
      await admin.messaging().send(message);
      res.send(`✅ Notificação de TESTE FORÇADO enviada.`);
    } else {
      // Diagnóstico detalhado
      const invDetails = invoices.map((i: any) => {
        const [d, m, y] = i.data_vencimento.split("/");
        const dt = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const diff = Math.ceil((dt.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return `ID: ${i.id} | Vencimento: ${i.data_vencimento} | Status: ${i.status} | Dias: ${diff}`;
      }).join("\n");

      res.send(`ℹ️ Nenhuma fatura elegível encontrada para o usuário ${finalUserId}.\n\nFaturas encontradas no IXC (${invoices.length}):\n${invDetails || "Nenhuma fatura retornada pela API"}`);
    }

  } catch (error: any) {
    console.error("Erro ao processar teste IXC:", error);
    res.status(500).send("Erro ao processar: " + error.message);
  }
});

/**
 * 💬 Notificação para Mensagens de Chat (Coleção chat/)
 */
export const sendChatNotification = functions.firestore
  .document("chat/{userId}/mensagens/{messageId}")
  .onCreate(async (snap, context) => {
    const messageData = snap.data();
    if (!messageData) return null;
    const userId = context.params.userId;

    console.log(`💬 Analisando mensagem para ${userId}:`, JSON.stringify(messageData));

    // Notificar se for Admin ou se for a IA (ARIA)
    const isFromStaff = messageData.isAdmin || messageData.isAI || messageData.user === "Suporte AVL";

    if (!isFromStaff) {
      console.log("ℹ️ Mensagem ignorada (enviada pelo próprio cliente)");
      return null;
    }

    try {
      const userDoc = await admin.firestore().collection("users").doc(userId).get();
      const userData = userDoc.data();

      if (!userDoc.exists || !userData?.fcmToken) {
        console.log(`⚠️ Usuário ${userId} não encontrado ou sem Token FCM`);
        return null;
      }

      const token = userData.fcmToken;
      const title = messageData.isAI ? "🤖 Assistente ARIA" : "👤 Suporte AVL";
      const body = messageData.content ?
        (messageData.content.length > 100 ? messageData.content.substring(0, 100) + "..." : messageData.content) :
        "📎 Enviou uma mídia para você";

      const message = {
        notification: {
          title: title,
          body: body,
        },
        data: {
          type: "chat",
          screen: "chat",
          userId: userId,
        },
        android: {
          priority: "high" as any,
          notification: {
            channelId: "chat",
            color: "#5a56c9",
            priority: "max" as any,
          },
        },
        apns: {
          payload: {
            aps: {
              alert: { title, body },
              sound: "default",
              badge: 1,
            },
          },
        },
        token: token,
      };

      await admin.messaging().send(message);
      console.log(`✅ Notificação de chat enviada para ${userId}`);
      return true;
    } catch (error) {
      console.error("❌ Erro ao enviar notificação de chat:", error);
      return null;
    }
  });


/**
 * 📤 Dispara quando o Admin envia uma mensagem no Painel
 * Replica essa mensagem para o WhatsApp E para o App do cliente
 */
export const onDashboardMessageSent = functions
  .runWith({ memory: "256MB", timeoutSeconds: 120 })
  .firestore
  .document("chat/{chatId}/mensagens/{messageId}")
  .onCreate(async (snapshot, context) => {
    const messageData = snapshot.data();
    const chatId = context.params.chatId; // Telefone limpo

    // Evita enviar notas internas, mensagens do cliente ou mensagens já enviadas pelo bot/celular
    if (
      messageData.isAdmin !== true ||
      messageData.isPrivate === true ||
      messageData.skipWhatsappSync === true ||
      messageData.source === "system" ||
      messageData.source === "josue_ai" ||
      messageData.source === "whatsapp" ||
      messageData.source === "whatsapp_device"
    ) {
      return null;
    }

    console.log(
      `📤 Replicando resposta do painel para: ${chatId} | Mídia: ${messageData.mediaType || "texto"}`
    );

    let waService: WhatsAppService;
    try {
      const { apiKey: whatsappApiKey, baseUrl: whatsappBaseUrl } = getWhapiConfig();
      waService = new WhatsAppService(whatsappBaseUrl, whatsappApiKey);
    } catch (err: any) {
      console.error("❌ WHAPI/Z-API não configurado no ambiente:", err.message);
      await snapshot.ref
        .set(
          {
            deliveryStatus: "FAILED",
            deliveryError: "Z-API não configurada no servidor.",
            deliveryUpdatedAtMs: Date.now(),
          },
          { merge: true }
        )
        .catch(() => undefined);
      return null;
    }

    try {
      // 1. Enviar para WhatsApp e registrar messageId para confirmação de entrega/leitura (✓✓ azul)
      let targetRecipient = chatId;
      if (!/^(\d{10,15}|.+@lid)$/.test(chatId)) {
        const parentSnap = await db.collection("chat").doc(chatId).get();
        const savedPhone = String(parentSnap.data()?.phone || parentSnap.data()?.chatLid || "").trim();
        if (savedPhone) targetRecipient = savedPhone;
      }

      let zapiResp: any = null;
      const replyToZapiId = String(messageData.replyTo?.zapiMessageId || "").trim() || null;
      if (messageData.mediaUrl) {
        zapiResp = await waService.sendMediaMessage(
          targetRecipient,
          messageData.mediaUrl,
          messageData.content,
          messageData.mediaType,
          {
            fileName: messageData.mediaName || null,
            mimeType: messageData.mediaMimeType || null,
            replyToMessageId: replyToZapiId,
          }
        );
      } else {
        zapiResp = await waService.sendTextMessage(targetRecipient, messageData.content, replyToZapiId);
      }

      const zapiMsgId = String(zapiResp?.messageId || zapiResp?.id || "").trim() || null;
      const zapiZaapId = String(zapiResp?.zaapId || "").trim() || null;
      await snapshot.ref
        .set(
          {
            zapiMessageId: zapiMsgId,
            zapiZaapId: zapiZaapId,
            deliveryStatus: "SENT",
            deliveryError: null,
            deliveryUpdatedAtMs: Date.now(),
          },
          { merge: true }
        )
        .catch(() => undefined);

      if (zapiMsgId || zapiZaapId) {
        await indexZapiMessageForTracking({
          messageId: zapiMsgId,
          zaapId: zapiZaapId,
          collectionPath: `chat/${chatId}/mensagens`,
          docId: snapshot.id,
          chatId,
        });
      }

      // 2. Tentar replicar para o App (se o usuário existir)
      const usersSnapshot = await admin.firestore().collection("users")
        .where("phone", "==", chatId)
        .limit(1)
        .get();

      if (!usersSnapshot.empty) {
        const userId = usersSnapshot.docs[0].id;
        console.log(`📱 Espelhando mensagem para o App (userId: ${userId})`);

        // 2.1 Tentar encontrar uma sala ativa ou criar uma nova
        const chatRoomsSnap = await admin.firestore().collection("chatRooms")
          .where("userId", "==", userId)
          .where("isActive", "==", true)
          .limit(1)
          .get();

        let roomId: string;
        if (chatRoomsSnap.empty) {
          const newRoom = await admin.firestore().collection("chatRooms").add({
            userId,
            userName: usersSnapshot.docs[0].data().name || "Cliente",
            lastMessage: messageData.content || messageData.mediaName || "📎 Mídia",
            lastMessageTime: admin.firestore.FieldValue.serverTimestamp(),
            unreadCount: 0,
            isActive: true,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          roomId = newRoom.id;
        } else {
          roomId = chatRoomsSnap.docs[0].id;
        }

        // 2.2 Adicionar a mensagem na subcoleção 'messages'
        await admin.firestore().collection("chatRooms").doc(roomId).collection("messages").add({
          content: messageData.content || "",
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          isAdmin: true,
          senderId: "admin",
          senderName: "Atendente AVL",
          mediaUrl: messageData.mediaUrl || null,
          mediaType: messageData.mediaType || null,
          mediaName: messageData.mediaName || null,
        });

        // 2.3 Atualizar cabeçalho da sala
        await admin.firestore().collection("chatRooms").doc(roomId).update({
          lastMessage: messageData.content || messageData.mediaName || "📎 Mídia",
          lastMessageTime: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      return true;
    } catch (error: any) {
      const errMsg = String(
        error?.response?.data?.message ||
          error?.response?.data?.error ||
          error?.message ||
          "Erro ao entregar mensagem no WhatsApp"
      ).slice(0, 300);
      console.error("❌ Erro na replicação da mensagem:", errMsg, error);
      await snapshot.ref
        .set(
          {
            deliveryStatus: "FAILED",
            deliveryError: errMsg,
            deliveryUpdatedAtMs: Date.now(),
          },
          { merge: true }
        )
        .catch(() => undefined);
      return null;
    }
  });

/**
 * 📱 Dispara quando o cliente envia uma mensagem pelo App (Mobile)
 * Escuta em 'chatRooms/{roomId}/messages/{messageId}'
 * Replica essa mensagem para o chat do Painel/Dashboard
 */
export const onAppMessageSent = functions.firestore
  .document("chatRooms/{roomId}/messages/{messageId}")
  .onCreate(async (snapshot, context) => {
    const messageData = snapshot.data();
    if (messageData.isAdmin === true) return null; // Ignorar mensagens enviadas pelo admin

    const roomId = context.params.roomId;
    console.log(`📱 Nova mensagem do App recebida na sala: ${roomId}`);

    try {
      const roomDoc = await admin.firestore().collection("chatRooms").doc(roomId).get();
      const roomData = roomDoc.data();
      const userId = roomData?.userId;

      if (!userId) return null;

      const userDoc = await admin.firestore().collection("users").doc(userId).get();
      const userData = userDoc.data();
      const phone = userData?.phone || userData?.telefone;

      if (!phone) {
        console.warn(`⚠️ Usuário ${userId} sem telefone. Sincronização parcial.`);
        return null;
      }

      const phoneClean = phone.replace(/\D/g, "");

      // Sincronizar com a collection 'chat' do Dashboard
      await admin.firestore().collection("chat").doc(phoneClean).collection("mensagens").add({
        user: userData?.name || roomData?.userName || "Usuário App",
        content: messageData.content,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        isAdmin: false,
        avatar: userData?.avatar || roomData?.userAvatar || null,
        source: "app",
      });

      // Atualizar cabeçalho do chat no Dashboard
      await admin.firestore().collection("chat").doc(phoneClean).set({
        name: userData?.name || roomData?.userName || "Usuário App",
        lastMessage: messageData.content,
        lastMessageTime: admin.firestore.FieldValue.serverTimestamp(),
        unreadCount: admin.firestore.FieldValue.increment(1),
        source: "app",
      }, { merge: true });

      return true;
    } catch (error) {
      console.error("❌ Erro ao sincronizar mensagem do App:", error);
      return null;
    }
  });

/**
 * 🏆 Notificação para Vencedores
 */
export const sendWinnerNotification = functions.firestore
  .document("winners/{winnerId}")
  .onCreate(async (snap) => {
    const winnerData = snap.data();
    const winnerCpf = winnerData.cpf;
    try {
      const usersRef = admin.firestore().collection("users");
      const cpfNumbers = winnerCpf.replace(/\D/g, "");
      const cpfFormatted = cpfNumbers.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");

      const querySnapshot = await usersRef
        .where("fcmToken", "!=", null)
        .where("cpf", "in", [cpfNumbers, cpfFormatted])
        .get();

      if (querySnapshot.empty) return null;

      const notifications: Promise<any>[] = [];
      querySnapshot.forEach((doc) => {
        const token = doc.data().fcmToken;
        const message = {
          notification: {
            title: "🎊 Você Ganhou no Pré-mix! 🎊",
            body: `Parabéns ${winnerData.name}! Você foi o grande vencedor. Abra o app para resgatar!`,
          },
          data: { type: "winner", screen: "HomePage", winnerName: winnerData.name },
          android: { priority: "high" as any, notification: { channelId: "alerts", color: "#22C55E" } },
          token: token,
        };
        notifications.push(admin.messaging().send(message));
      });
      return Promise.all(notifications);
    } catch (error) {
      console.error("❌ Erro ao enviar notificação de vencedor:", error);
      return null;
    }
  });

/**
 * 💬 Notificação para Mensagens de Chat do App
 */
export const sendUserChatNotification = functions.firestore
  .document("users/{userId}/mensagens/{messageId}")
  .onCreate(async (snap, context) => {
    const messageData = snap.data();
    const userId = context.params.userId;
    if (messageData.enviadoPor === "cliente") return null;

    try {
      const userDoc = await admin.firestore().collection("users").doc(userId).get();
      if (!userDoc.exists || !userDoc.data()?.fcmToken) return null;

      const token = userDoc.data()?.fcmToken;
      const message = {
        notification: {
          title: messageData.enviadoPor === "admin" ? "Atendente AVL" : "Assistente AVL",
          body: messageData.texto ? messageData.texto.substring(0, 100) : "📎 Mídia recebida",
        },
        data: { type: "chat", screen: "chat", userId: userId },
        android: { priority: "high" as any, notification: { channelId: "chat", color: "#5a56c9" } },
        token: token,
      };
      await admin.messaging().send(message);
      return true;
    } catch (error) {
      console.error("❌ Erro ao enviar notificação de chat:", error);
      return null;
    }
  });

/**
 * 🤖 Webhook para o Bot de WhatsApp (Z-API + compatibilidade Whapi)
 * Suporta 100% de textos, fotos, stickers, vídeos, áudios (PTT) e documentos
 * Modo Economia Firebase: usa URL direta hospedada pela Z-API (30 dias grátis, 0 MB no Storage)
 */
export const whatsappWebhook = functions.runWith({
  memory: "256MB",
  timeoutSeconds: 60,
  secrets: ["GEMINI_API_KEY"],
}).https.onRequest(async (req, res) => {
  if (req.method === "GET") {
    res.status(200).send("Webhook active");
    return;
  }

  try {
    const payload = req.body || {};
    const messageData = payload.data || (payload.messages && payload.messages[0]) || payload;

    // Ignora callbacks técnicos que não são mensagens recebidas/enviadas pelo aparelho
    const webhookEventType = String(payload.type || messageData.type || "").trim();
    if (
      webhookEventType === "DeliveryCallback" ||
      webhookEventType === "PresenceChatCallback" ||
      webhookEventType === "MessageStatusCallback" ||
      webhookEventType === "ConnectedCallback" ||
      webhookEventType === "DisconnectedCallback"
    ) {
      res.status(200).send("Ignored event");
      return;
    }

    const chatIdField = String(
      messageData.chat_id || messageData.chatId || messageData.key?.remoteJid || ""
    );
    const senderField = String(
      messageData.phone || messageData.from || messageData.sender || ""
    );
    const from = senderField || chatIdField;

    const rawType = String(messageData.type || "").toLowerCase();
    let mediaUrl: string | null =
      messageData.image?.imageUrl ||
      messageData.image?.link ||
      messageData.image?.url ||
      messageData.sticker?.stickerUrl ||
      messageData.sticker?.link ||
      messageData.audio?.audioUrl ||
      messageData.audio?.link ||
      messageData.voice?.audioUrl ||
      messageData.voice?.link ||
      messageData.video?.videoUrl ||
      messageData.video?.link ||
      messageData.video?.url ||
      messageData.document?.documentUrl ||
      messageData.document?.link ||
      messageData.document?.url ||
      messageData.link ||
      messageData.url ||
      null;
    let mediaType: "image" | "audio" | "video" | "document" | null = null;
    let mediaIdToDownload: string | null = null;
    let mimeType = "";
    let fileNameToSave: string | null = null;
    let mediaCaption: string | undefined;
    let mediaDuration: number | null = null;

    if (rawType === "image" || messageData.image) {
      mediaUrl = messageData.image?.imageUrl || messageData.image?.link || messageData.image?.url || mediaUrl;
      mediaIdToDownload = messageData.image?.id || (rawType === "image" ? messageData.id : null);
      mimeType = messageData.image?.mimeType || messageData.image?.mime_type || "image/jpeg";
      mediaCaption = messageData.image?.caption;
      mediaType = "image";
    } else if (rawType === "sticker" || messageData.sticker) {
      mediaUrl = messageData.sticker?.stickerUrl || messageData.sticker?.link || messageData.sticker?.url || mediaUrl;
      mediaIdToDownload = messageData.sticker?.id || (rawType === "sticker" ? messageData.id : null);
      mimeType = messageData.sticker?.mimeType || messageData.sticker?.mime_type || "image/webp";
      mediaType = "image";
    } else if (rawType === "audio" || rawType === "voice" || rawType === "ptt" || messageData.audio || messageData.voice) {
      mediaUrl =
        messageData.audio?.audioUrl ||
        messageData.audio?.link ||
        messageData.audio?.url ||
        messageData.voice?.audioUrl ||
        messageData.voice?.link ||
        messageData.voice?.url ||
        mediaUrl;
      mediaIdToDownload =
        messageData.audio?.id ||
        messageData.voice?.id ||
        (rawType === "audio" || rawType === "voice" || rawType === "ptt" ? messageData.id : null);
      mimeType =
        messageData.audio?.mimeType ||
        messageData.audio?.mime_type ||
        messageData.voice?.mimeType ||
        messageData.voice?.mime_type ||
        "audio/ogg";
      const secs = Number(messageData.audio?.seconds ?? messageData.voice?.seconds ?? 0);
      mediaDuration = Number.isFinite(secs) && secs > 0 ? Math.round(secs) : null;
      mediaType = "audio";
    } else if (rawType === "video" || messageData.video) {
      mediaUrl = messageData.video?.videoUrl || messageData.video?.link || messageData.video?.url || mediaUrl;
      mediaIdToDownload = messageData.video?.id || (rawType === "video" ? messageData.id : null);
      mimeType = messageData.video?.mimeType || messageData.video?.mime_type || "video/mp4";
      mediaCaption = messageData.video?.caption;
      const secs = Number(messageData.video?.seconds ?? 0);
      mediaDuration = Number.isFinite(secs) && secs > 0 ? Math.round(secs) : null;
      mediaType = "video";
    } else if (rawType === "document" || messageData.document) {
      mediaUrl =
        messageData.document?.documentUrl ||
        messageData.document?.link ||
        messageData.document?.url ||
        mediaUrl;
      mediaIdToDownload = messageData.document?.id || (rawType === "document" ? messageData.id : null);
      mimeType =
        messageData.document?.mimeType ||
        messageData.document?.mime_type ||
        "application/pdf";
      fileNameToSave =
        messageData.document?.fileName ||
        messageData.document?.file_name ||
        messageData.document?.filename ||
        messageData.document?.title ||
        null;
      mediaCaption = messageData.document?.caption;
      mediaType = "document";
    }

    const text =
      messageData.body ||
      messageData.text?.message ||
      messageData.text?.body ||
      messageData.message?.conversation ||
      messageData.buttonsResponseMessage?.message ||
      messageData.buttonResponseMessage?.message ||
      messageData.listResponseMessage?.message ||
      mediaCaption ||
      (typeof messageData.text === "string" ? messageData.text : undefined);

    const selectionId =
      messageData.buttonsResponseMessage?.buttonId ||
      messageData.buttonsResponseMessage?.selectedButtonId ||
      messageData.buttonResponseMessage?.buttonId ||
      messageData.buttonResponseMessage?.selectedButtonId ||
      messageData.listResponseMessage?.selectedRowId ||
      messageData.list_reply?.id ||
      messageData.button_reply?.id;

    const incomingMsgId = String(messageData.messageId || messageData.id || "").trim();
    const incomingZaapId = String(messageData.zaapId || "").trim();

    const isGroup =
      chatIdField.includes("@g.us") ||
      senderField.includes("@g.us") ||
      messageData.isGroup === true ||
      from.includes("@group") ||
      from.endsWith("-group");
    const fromMe =
      messageData.from_me === true ||
      messageData.fromMe === true ||
      messageData.key?.fromMe === true;
    const fromApi =
      messageData.fromApi === true || messageData.from_api === true;

    const rawChatName = String(messageData.chatName || "").trim();
    const contactChatName = rawChatName && !rawChatName.includes("@lid") ? rawChatName : "";
    const rawSenderName = String(messageData.senderName || "").trim();
    const cleanSenderName = rawSenderName && !rawSenderName.includes("@lid") ? rawSenderName : "";
    const senderName =
      (fromMe ? contactChatName : "") ||
      cleanSenderName ||
      contactChatName ||
      messageData.from_name ||
      messageData.pushname ||
      payload.contacts?.[0]?.pushname ||
      "Cliente WhatsApp";
    const senderPhoto =
      !fromMe
        ? String(messageData.photo || messageData.senderPhoto || "").trim() || null
        : String(messageData.photo || "").trim() || null;

    const hasAnyContent = Boolean(
      text || selectionId || mediaUrl || mediaIdToDownload || mediaType || messageData.media
    );

    // Ignora grupos, eventos sem conteúdo ou ecos de mensagens enviadas pela própria API
    if (!from || !hasAnyContent || isGroup || (fromMe && fromApi)) {
      const reason = !from
        ? "Sem remetente"
        : !hasAnyContent
        ? "Sem conteúdo"
        : isGroup
        ? "Mensagem de grupo"
        : "Eco de mensagem enviada via API (fromMe+fromApi)";

      console.log(`⏭️ Webhook ignorado. Motivo: ${reason} | From: ${from} | Tipo: ${rawType || mediaType || "text"}`);
      res.status(200).send("Ignored");
      return;
    }

    const incomingChatLid = String(
      messageData.chatLid ||
        (chatIdField.includes("@lid") ? chatIdField : "") ||
        (senderField.includes("@lid") ? senderField : "")
    ).trim();
    const isLidSource =
      from.includes("@lid") || (Boolean(incomingChatLid) && !senderField.replace(/\D/g, ""));
    const rawDigits = isLidSource ? "" : from.replace(/\D/g, "");
    if (!rawDigits && !incomingChatLid) {
      res.status(200).send("Ignored");
      return;
    }

    const { host: ispfyHost, token: ispfyToken } = getIspfyConfig();
    const { apiKey: whapiApiKey, baseUrl: whapiBaseUrl } = getWhapiConfig();
    const ispfyService = new IspfyBackendService(ispfyHost, ispfyToken);
    const waService = new WhatsAppService(whapiBaseUrl, whapiApiKey);
    const geminiApiKey = process.env.GEMINI_API_KEY;

    // Resolve o ID canônico do chat no Firestore (unifica 9º dígito, DDI 55, campo phone e @lid)
    const resolvedTarget = await resolveCanonicalChatTarget({
      rawPhoneDigits: rawDigits,
      chatLid: incomingChatLid || null,
      contactName: contactChatName || (!fromMe ? senderName : ""),
      zapiBaseUrl: whapiBaseUrl,
      zapiToken: whapiApiKey,
    });
    const cleanPhone = resolvedTarget.chatId;
    const phoneToPersist = resolvedTarget.phone;

    console.log(
      `📩 [WA-WEBHOOK] De ${senderName} | raw=${from} | lid=${incomingChatLid || "-"} | resolvedChatId=${cleanPhone} | fromMe=${fromMe} | mediaType=${mediaType || "text"} | hasUrl=${Boolean(mediaUrl)}`
    );

    // Modo Economia Firebase:
    // Se a Z-API já forneceu uma URL direta (hospedada grátis por 30 dias), usamos ela direto
    // sem duplicar arquivos no Firebase Storage nem gastar banda de egress.
    // Só fazemos fallback para o Storage se vier mediaId legado sem URL (Whapi).
    if (mediaType && !mediaUrl && mediaIdToDownload && whapiApiKey) {
      try {
        const mediaBuffer = await waService.downloadMedia(mediaIdToDownload);
        if (mediaBuffer && mediaBuffer.length > 0) {
          const { randomUUID } = require("crypto");
          const token = randomUUID();
          const bucket = admin.storage().bucket("avl-telecom.appspot.com");

          const mimeLower = String(mimeType || "").toLowerCase();
          let ext = "";
          if (mimeLower.includes("jpeg") || mimeLower.includes("jpg")) ext = ".jpg";
          else if (mimeLower.includes("png")) ext = ".png";
          else if (mimeLower.includes("webp")) ext = ".webp";
          else if (mimeLower.includes("ogg") || mimeLower.includes("opus")) ext = ".ogg";
          else if (mimeLower.includes("mpeg") || mimeLower.includes("mp3")) ext = ".mp3";
          else if (mimeLower.includes("mp4")) ext = mediaType === "audio" ? ".m4a" : ".mp4";
          else if (mimeLower.includes("pdf")) ext = ".pdf";

          const safeOriginalName = fileNameToSave
            ? fileNameToSave.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120)
            : `${incomingMsgId || mediaIdToDownload}${ext}`;
          const finalFileName =
            ext && !safeOriginalName.includes(".") ? `${safeOriginalName}${ext}` : safeOriginalName;
          const filePath = `chat_media/${cleanPhone}/${Date.now()}_${finalFileName}`;
          const file = bucket.file(filePath);

          await file.save(mediaBuffer, {
            metadata: {
              contentType: mimeType || "application/octet-stream",
              cacheControl: "public, max-age=604800",
              metadata: { firebaseStorageDownloadTokens: token },
            },
          });

          mediaUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(
            filePath
          )}?alt=media&token=${token}`;
          console.log(`✅ Mídia legada (sem URL direta) salva no Storage: ${filePath}`);
        }
      } catch (err: any) {
        console.warn(`⚠️ Falha ao baixar mídia legada (${mediaIdToDownload}): ${err.message}`);
      }
    }

    const content =
      text ||
      (mediaType === "image"
        ? "📎 Foto"
        : mediaType === "audio"
        ? "🎵 Áudio"
        : mediaType === "document"
        ? `📄 ${fileNameToSave || "Documento"}`
        : mediaType === "video"
        ? "🎥 Vídeo"
        : "📎 Mídia");

    // Se a mensagem foi enviada diretamente do celular/WhatsApp Web da empresa (fromMe=true, fromApi=false),
    // sincroniza no histórico do Chat com deduplicação (zapi_message_index), zera não-lidas e rastreia ticks ✓✓!
    if (fromMe && !fromApi) {
      // Deduplicação dupla: impede eco se a mensagem já foi enviada pela API/painel/bot ou reenviada pelo webhook
      const dedupIds = [incomingMsgId, incomingZaapId].filter(Boolean);
      for (const rawId of dedupIds) {
        const key = sanitizeIndexKey(rawId);
        if (!key) continue;
        const existingIdx = await db.collection("zapi_message_index").doc(key).get();
        if (existingIdx.exists) {
          console.log(`⏭️ [WA-WEBHOOK] Mensagem fromMe já registrada (${rawId}), ignorando duplicata.`);
          res.status(200).send("Already synced");
          return;
        }
      }

      // Também checa por zapiMessageId recente no próprio chat caso não estivesse no índice
      if (incomingMsgId) {
        const dupSnap = await db
          .collection("chat")
          .doc(cleanPhone)
          .collection("mensagens")
          .where("zapiMessageId", "==", incomingMsgId)
          .limit(1)
          .get()
          .catch(() => null);
        if (dupSnap && !dupSnap.empty) {
          res.status(200).send("Already synced");
          return;
        }
      }

      // Preserva contexto de resposta/citação feita pelo celular quando Z-API informar referenceMessageId
      let replyToPayload: Record<string, unknown> | null = null;
      const quotedZapiId = String(
        messageData.referenceMessageId || messageData.quotedMessageId || ""
      ).trim();
      if (quotedZapiId) {
        const quotedSnap = await db
          .collection("chat")
          .doc(cleanPhone)
          .collection("mensagens")
          .where("zapiMessageId", "==", quotedZapiId)
          .limit(1)
          .get()
          .catch(() => null);
        if (quotedSnap && !quotedSnap.empty) {
          const qDoc = quotedSnap.docs[0];
          const qData = qDoc.data();
          replyToPayload = {
            id: qDoc.id,
            zapiMessageId: quotedZapiId,
            user: String(qData.user || (qData.isAdmin ? "Atendente" : contactChatName || "Cliente")),
            content: String(qData.content || "📎 Mídia").slice(0, 140),
            fromMe: Boolean(qData.isAdmin),
          };
        }
      }

      const resolvedDeviceContactName =
        contactChatName ||
        resolvedTarget.resolvedName ||
        (senderName && !senderName.includes("@lid") ? senderName : "Cliente WhatsApp");
      const resolvedDeviceAvatar = senderPhoto || resolvedTarget.resolvedAvatar || null;

      await logMessageToDashboard(
        cleanPhone,
        content,
        true,
        "whatsapp_device",
        resolvedDeviceContactName,
        null,
        mediaUrl,
        mediaType,
        {
          fileName: fileNameToSave,
          mimeType: mimeType || null,
          duration: mediaDuration,
          zapiMessageId: incomingMsgId || null,
          zapiZaapId: incomingZaapId || null,
          avatarUrl: resolvedDeviceAvatar,
          userLabel: "WhatsApp (Celular)",
          clearUnread: true,
          replyTo: replyToPayload,
          chatLid: incomingChatLid || null,
          phoneValue: phoneToPersist,
        }
      );
      res.status(200).send("Synced from device");
      return;
    }

    console.log(`📩 Mensagem processada de ${senderName} (${cleanPhone}): ${content} | Mídia: ${mediaUrl ? "SIM" : "NÃO"}`);

    const sessionRef = db.collection("bot_sessions").doc(cleanPhone);
    const [sessionSnap, chatSnap, automationsSnap] = await Promise.all([
      sessionRef.get(),
      db.collection("chat").doc(cleanPhone).get(),
      db.collection("settings").doc("ispfy_automations").get(),
    ]);
    const session = sessionSnap.data() as any;
    const chatData = chatSnap.data() as any;
    const automationsCfg = automationsSnap.exists ? automationsSnap.data() || {} : {};

    // --- BUSCA CLIENTE NO ISPFY COM OTIMIZAÇÃO E CACHE DE 24H ---
    let cliente: any = null;
    const cachedClient = session?.ispfyCliente || session?.ixcCliente;
    const cachedUpdatedAt = session?.ispfyClienteUpdatedAt || session?.ixcClienteUpdatedAt;
    if (cachedClient && cachedUpdatedAt) {
      const lastUpdate = cachedUpdatedAt.toDate ? cachedUpdatedAt.toDate() : new Date(cachedUpdatedAt);
      if (Date.now() - lastUpdate.getTime() < 24 * 60 * 60 * 1000) {
        cliente = cachedClient;
        console.log(`⚡ Usando cliente ISPFY do cache para ${cleanPhone}: ${cliente.razao || cliente.nome}`);
      }
    }

    if (!cliente) {
      const savedIspfyId = chatData?.ispfy_id || chatData?.ixc_id;
      if (savedIspfyId) {
        console.log(`🔍 Buscando cliente ISPFY por ID (${savedIspfyId}) salvo no chat...`);
        cliente = await ispfyService.buscarClientePorId(String(savedIspfyId));
      }

      if (!cliente) {
        cliente = await ispfyService.buscarClientePorTelefone(cleanPhone, db);
      }

      if (cliente) {
        const clienteNome = cliente.razao || cliente.nome_razao || cliente.nome || senderName;
        const normalizedCliente = { ...cliente, razao: clienteNome };
        cliente = normalizedCliente;

        await sessionRef.set({
          ispfyCliente: normalizedCliente,
          ispfyClienteUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });

        await db.collection("chat").doc(cleanPhone).set({
          ispfy_id: String(cliente.id),
          ixc_id: String(cliente.id),
        }, { merge: true });
      }
    }

    const clienteDisplayName = cliente?.razao || cliente?.nome_razao || cliente?.nome || senderName;
    const firstName = clienteDisplayName.split(" ")[0];

    // --- LOG PARA DASHBOARD ---
    await logMessageToDashboard(
      cleanPhone,
      content,
      false,
      "whatsapp",
      firstName,
      cliente,
      mediaUrl,
      mediaType,
      {
        fileName: fileNameToSave,
        mimeType: mimeType || null,
        duration: mediaDuration,
        zapiMessageId: incomingMsgId || null,
        avatarUrl: senderPhoto,
        chatLid: incomingChatLid || null,
        phoneValue: phoneToPersist,
      }
    );

    // --- CONTROLE ADMIN ---
    const normalizedText = text?.toLowerCase().trim();
    if (normalizedText === "#robo:desligar" || normalizedText === "#bot:off") {
      await db.collection("bot_config").doc("global").set({ active: false }, { merge: true });
      await waService.sendTextMessage(from, "🛑 *Robô DESATIVADO.*");
      res.status(200).send("OK"); return;
    }
    if (normalizedText === "#robo:ligar" || normalizedText === "#bot:on") {
      await db.collection("bot_config").doc("global").set({ active: true }, { merge: true });
      await waService.sendTextMessage(from, "✅ *Robô ATIVADO.*");
      res.status(200).send("OK"); return;
    }
    if (normalizedText === "#josue:on") {
      await db.collection("chat").doc(cleanPhone).set({ aiEnabled: true }, { merge: true });
      await waService.sendTextMessage(from, "🤖 *Josué IA ativado* para esta conversa.");
      res.status(200).send("OK"); return;
    }
    if (normalizedText === "#josue:off") {
      await db.collection("chat").doc(cleanPhone).set({ aiEnabled: false }, { merge: true });
      await waService.sendTextMessage(from, "👤 *Josué IA desativado* para esta conversa.");
      res.status(200).send("OK"); return;
    }

    // Verificar Ativo
    const botConfig = await db.collection("bot_config").doc("global").get();
    if (botConfig.exists && botConfig.data()?.active === false) {
      res.status(200).send("Disabled"); return;
    }
    if (automationsCfg.botEnabled === false) {
      res.status(200).send("Disabled"); return;
    }

    if (text?.startsWith("#debug")) {
      await waService.sendTextMessage(from, `🛠️ DEBUG ISPFY: ${cleanPhone} | ID: ${cliente?.id || "N/A"} | Bairro: ${cliente?.bairro || "N/A"}`);
      res.status(200).send("OK"); return;
    }

    // --- VERIFICAÇÃO DE PAUSA (ATENDIMENTO HUMANO) ---
    if (session?.pausedUntil) {
      const pausedDate = session.pausedUntil.toDate ? session.pausedUntil.toDate() : new Date(session.pausedUntil);
      if (pausedDate > new Date()) {
        console.log(`⏸️ Bot pausado para ${cleanPhone} até ${pausedDate}. Mensagem entregue ao humano.`);
        res.status(200).send("OK"); return;
      }
    }

    // --- ESTADO: AGUARDANDO CPF ---
    const isOnlyDigits = /^\d+$/.test((text || "").trim());
    const pureNumbers = (text || "").replace(/\D/g, "");
    if (session?.state === "WAITING_FOR_CPF" || (isOnlyDigits && (pureNumbers.length === 11 || pureNumbers.length === 14))) {
      await waService.sendTextMessage(from, "🔍 Buscando cadastro no ISPFY...");
      const clienteByDocRaw = await ispfyService.buscarClientePorDocumento(pureNumbers);
      if (clienteByDocRaw) {
        const clienteByDoc = {
          ...clienteByDocRaw,
          razao: clienteByDocRaw.razao || clienteByDocRaw.nome_razao || clienteByDocRaw.nome || senderName,
        };
        await sessionRef.set({ 
          state: "IDLE", 
          pendingAction: null,
          ispfyCliente: clienteByDoc,
          ispfyClienteUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        
        await db.collection("chat").doc(cleanPhone).set({
          ispfy_id: String(clienteByDoc.id),
          ixc_id: String(clienteByDoc.id),
          name: clienteByDoc.razao,
          phone: cleanPhone,
        }, { merge: true });
        
        if (session?.pendingAction === "trust_unlock") {
          await processTrustUnlockRequest(from, cleanPhone, ispfyService, waService, sessionRef, clienteByDoc);
        } else if (session?.pendingAction === "request_invoice") {
          await handleInvoiceRequest(clienteByDoc, from, ispfyService, waService, cleanPhone);
        } else {
          const foundFirstName = clienteByDoc.razao ? clienteByDoc.razao.split(' ')[0] : undefined;
          await sendWelcomeMenu(from, waService, false, foundFirstName);
        }
      } else {
        await waService.sendTextMessage(from, "❌ Não localizado no ISPFY. Verifique se o CPF/CNPJ está correto e digite novamente.");
      }
      res.status(200).send("OK"); return;
    }

    // --- MODO JOSUÉ IA AUTÔNOMO (PER-CHAT OU GLOBAL SE LIGADO) ---
    const useJosueAutonomously =
      !selectionId &&
      Boolean(geminiApiKey) &&
      (chatData?.aiEnabled === true ||
        (automationsCfg?.josueAutoReply === true && chatData?.aiEnabled !== false));

    if (useJosueAutonomously && text) {
      try {
        const recentMsgsSnap = await db
          .collection("chat")
          .doc(cleanPhone)
          .collection("mensagens")
          .orderBy("timestamp", "desc")
          .limit(10)
          .get();

        const orderedMsgs = recentMsgsSnap.docs
          .map((d) => d.data())
          .reverse()
          .map((m: any) => ({
            isAdmin: Boolean(m.isAdmin),
            content: String(m.content || ""),
          }));

        if (orderedMsgs.length === 0) {
          orderedMsgs.push({ isAdmin: false, content: text });
        }

        const outage = cliente
          ? await ispfyService.verificarManutencaoAtivaNaRegiao(db, cliente.bairro, cliente.cidade)
          : null;

        const contextLines = [
          `Telefone do contato: ${cleanPhone}`,
          cliente
            ? `Cliente identificado no ISPFY: ID=${cliente.id}, Nome=${clienteDisplayName}, CPF/CNPJ=${cliente.cpf_cnpj || "N/A"}, Bairro=${cliente.bairro || "N/A"}, Cidade=${cliente.cidade || "N/A"}`
            : "Cliente ainda não vinculado a um CPF/CNPJ pelo telefone.",
          outage
            ? `ALERTA DE ROMPIMENTO REGIONAL ATIVO no bairro ${(outage.bairros || [outage.bairro]).join(", ")}: ${outage.titulo || outage.motivo || "Manutenção"} - ${outage.mensagem || outage.motivo || "Equipe em atuação"}`
            : "",
        ]
          .filter(Boolean)
          .join("\n");

        const josueReply = await runJosueChat({
          messages: orderedMsgs,
          clientName: firstName,
          contextInfo: contextLines,
        });

        if (josueReply && josueReply.trim()) {
          await waService.sendTextMessage(from, josueReply);
          await logMessageToDashboard(cleanPhone, josueReply, true, "josue_ai");
          res.status(200).send("OK");
          return;
        }
      } catch (josueErr: any) {
        console.error("⚠️ Falha no modo autônomo do Josué, seguindo fluxo padrão:", josueErr.message);
      }
    }

    // --- REAÇÃO AUTOMÁTICA PARA DOCUMENTOS/COMPROVANTES RECEBIDOS ---
    if (incomingMsgId && (mediaType === "image" || mediaType === "document")) {
      waService.sendReaction(from, incomingMsgId, "✅").catch(() => undefined);
    }

    // --- CAPTURA AUTOMÁTICA DE PESQUISA DE SATISFAÇÃO (CSAT BOTÕES Z-API) ---
    if (selectionId && /^csat_(os|chat)_/i.test(String(selectionId))) {
      const parts = String(selectionId).split("_");
      const csatKind = parts[1] || "atendimento";
      const csatRefId = parts.slice(2, -1).join("_") || cleanPhone;
      const csatScore = Number(parts[parts.length - 1] || 0);
      const csatLabel =
        csatScore >= 5
          ? "Excelente"
          : csatScore >= 4
          ? "Bom"
          : "Ainda com problema";

      await db.collection("os_csat_responses").add({
        kind: csatKind,
        ticketId: csatKind === "os" ? csatRefId : null,
        chatId: cleanPhone,
        clientName: senderName,
        clientPhone: cleanPhone,
        score: csatScore,
        label: csatLabel,
        selectionId: String(selectionId),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdAtMs: Date.now(),
      });

      if (csatScore <= 2) {
        await db.collection("chat").doc(cleanPhone).set(
          {
            tags: admin.firestore.FieldValue.arrayUnion("urgente", "suporte"),
            unreadCount: admin.firestore.FieldValue.increment(1),
            aiEnabled: false,
            lastMessage: `⚠️ Avaliação CSAT: Ainda com problema (${csatKind === "os" ? `O.S. #${csatRefId}` : "Atendimento"})`,
            lastMessageTime: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
        const replyUrgent =
          `Poxa, lamentamos muito que ainda esteja enfrentando dificuldade! 🙏\n\n` +
          `Já marcamos seu atendimento como *PRIORIDADE MÁXIMA* e um técnico/atendente da *AVL Telecom* vai falar com você agora mesmo.`;
        await waService.sendTextMessage(from, replyUrgent);
        await logMessageToDashboard(cleanPhone, replyUrgent, true, "system", senderName);
      } else {
        const replyOk =
          `Muito obrigado pela sua avaliação (*${csatLabel}*)! 💙🚀\n\n` +
          `Ficamos muito felizes em saber que tudo está funcionando bem. Conte sempre com a *AVL Telecom*!`;
        await waService.sendTextMessage(from, replyOk);
        await logMessageToDashboard(cleanPhone, replyOk, true, "system", senderName);
      }

      res.status(200).send("OK");
      return;
    }

    // --- DETECÇÃO DE INTENÇÃO ---
    console.log(`🤖 Processando mensagem de ${cleanPhone}: ${text || selectionId}`);
    const localResult = detectIntentLocal(text || "");
    let finalIntent = localResult.intent;

    if (selectionId) {
      finalIntent = selectionId === "opt_invoice" ? "request_invoice" : selectionId === "opt_support" ? "human_support" : selectionId === "opt_unlock" ? "trust_unlock" : "other";
    } else if (finalIntent === "other" && geminiApiKey) {
      const aiService = new AiService(geminiApiKey);
      const aiResult = await aiService.detectIntent(text || "");
      finalIntent = aiResult.intent;
    }

    // --- VERIFICAÇÃO PROATIVA DE ROMPIMENTO REGIONAL PARA QUEDA/SUPORTE ---
    const isConnectionReport =
      finalIntent === "human_support" ||
      finalIntent === "trust_unlock" ||
      (normalizedText &&
        (normalizedText.includes("sem internet") ||
          normalizedText.includes("caiu") ||
          normalizedText.includes("rompimento") ||
          normalizedText.includes("lenta")));

    if (cliente && isConnectionReport) {
      const outage = await ispfyService.verificarManutencaoAtivaNaRegiao(
        db,
        cliente.bairro,
        cliente.cidade
      );
      if (outage) {
        const previsao = outage.previsao ? `\n⏱️ *Previsão de retorno:* ${outage.previsao}` : "";
        const outageMsg =
          `⚠️ *Comunicado Técnico — ${cliente.bairro || "Sua Região"}*\n\n` +
          `Identificamos uma *${outage.titulo || outage.motivo || "Manutenção Regional"}* afetando a sua região no momento.\n` +
          `${outage.mensagem || outage.motivo || "Equipe técnica em campo trabalhando no restabelecimento."}${previsao}\n\n` +
          `Nossa equipe de campo já está atuando para restabelecer o sinal o mais rápido possível! 🙏`;
        await waService.sendTextMessage(from, outageMsg);
        await logMessageToDashboard(cleanPhone, outageMsg, true, "system", firstName);
        if (finalIntent !== "request_invoice") {
          res.status(200).send("OK");
          return;
        }
      }
    }

    // --- RESPOSTA ---
    if (finalIntent === "request_invoice") {
      await processInvoiceRequest(from, cleanPhone, ispfyService, waService, sessionRef, cliente);
    } else if (finalIntent === "trust_unlock") {
      await processTrustUnlockRequest(from, cleanPhone, ispfyService, waService, sessionRef, cliente);
    } else if (finalIntent === "human_support") {
      const msg = "🎧 Vou te transferir para um atendente humano. Aguarde um instante.";
      await waService.sendTextMessage(from, msg);
      await logMessageToDashboard(cleanPhone, msg, true, "system");
      
      const pauseUntil = admin.firestore.Timestamp.fromMillis(Date.now() + 3600000);
      await sessionRef.set({ pausedUntil: pauseUntil, state: "IDLE" }, { merge: true });
      console.log(`⏸️ Bot pausado por 1 hora para ${cleanPhone} (Intent: human_support)`);
    } else if (finalIntent === "other") {
      if (geminiApiKey) {
        console.log(`🤖 Chamando FAQ do Gemini para ${cleanPhone}...`);
        const aiService = new AiService(geminiApiKey);
        const faqResult = await aiService.answerGeneralQuestion(text || "", firstName);
        
        if (faqResult.shouldEscalate) {
          const msg = faqResult.response || "Entendi. Vou te transferir para um de nossos especialistas. Aguarde um momento. 🎧";
          await waService.sendTextMessage(from, msg);
          await logMessageToDashboard(cleanPhone, msg, true, "system");
          
          const pauseUntil = admin.firestore.Timestamp.fromMillis(Date.now() + 3600000);
          await sessionRef.set({ pausedUntil: pauseUntil, state: "IDLE" }, { merge: true });
          console.log(`⏸️ Bot pausado por 1 hora para ${cleanPhone} (Intent: other, Escalado pela IA)`);
        } else {
          await waService.sendTextMessage(from, faqResult.response);
          await logMessageToDashboard(cleanPhone, faqResult.response, true, "system");
          console.log(`✅ FAQ do Gemini respondido para ${cleanPhone}. Bot continua ativo.`);
        }
      } else {
        const msg = "Entendi. Vou te transferir para um de nossos especialistas. Aguarde um momento. 🎧";
        await waService.sendTextMessage(from, msg);
        await logMessageToDashboard(cleanPhone, msg, true, "system");
        
        const pauseUntil = admin.firestore.Timestamp.fromMillis(Date.now() + 3600000);
        await sessionRef.set({ pausedUntil: pauseUntil, state: "IDLE" }, { merge: true });
        console.log(`⏸️ Bot pausado por 1 hora para ${cleanPhone} (Intent: other, Sem chave Gemini)`);
      }
    } else {
      console.log(`📋 Enviando menu de boas-vindas para ${cleanPhone}`);
      const menu = await sendWelcomeMenu(from, waService, false, firstName);
      await logMessageToDashboard(cleanPhone, menu, true, "system");
    }

    res.status(200).send("OK");
  } catch (error) {
    console.error("Webhook Error:", error);
    res.status(200).send("Error");
  }
});

function detectIntentLocal(text: string): { intent: string } {
  const t = text.toLowerCase().trim();
  if (["oi", "olá", "ola", "bom dia", "boa tarde", "boa noite"].includes(t)) return { intent: 'greeting' };
  if (t === "1" || t.includes("fatura") || t.includes("boleto") || t.includes("pix") || t.includes("pagamento") || t.includes("2 via") || t.includes("segunda via")) return { intent: 'request_invoice' };
  if (t === "2" || t.includes("suporte") || t.includes("atendente") || t.includes("humano")) return { intent: 'human_support' };
  if (t === "3" || t.includes("desbloqueio") || t.includes("confiança") || t.includes("liberar") || t.includes("sem internet") || t.includes("liberação")) return { intent: 'trust_unlock' };
  return { intent: 'other' };
}

async function processInvoiceRequest(from: string, cleanPhone: string, ispfyService: IspfyBackendService, waService: WhatsAppService, sessionRef: admin.firestore.DocumentReference, cliente?: any) {
  if (cliente) {
    await handleInvoiceRequest(cliente, from, ispfyService, waService, cleanPhone);
  } else {
    await sessionRef.set({ state: "WAITING_FOR_CPF", pendingAction: "request_invoice", phone: cleanPhone }, { merge: true });
    const msg = "🤔 Não achei seu cadastro pelo telefone. Me informe seu *CPF ou CNPJ* (apenas números).";
    await waService.sendTextMessage(from, msg);
    await logMessageToDashboard(cleanPhone, msg, true, "system");
  }
}

async function sendWelcomeMenu(from: string, waService: WhatsAppService, isFallback: boolean, firstName?: string) {
  const greeting = firstName ? `Olá ${firstName}! 👋` : "Olá! 👋";
  const menuText = `${greeting} Sou o assistente da *AVL Telecom*. 🤖\n\n1. 📄 *Minha Fatura*\n2. 🎧 *Suporte Humano*\n3. 🔓 *Desbloqueio de Confiança*\n4. ⚙️ *Outros*`;
  
  if (isFallback) {
    await waService.sendTextMessage(from, menuText);
  } else {
    try {
      const sections = [{ title: "Opções", rows: [
        { id: "opt_invoice", title: "Minha Fatura" },
        { id: "opt_support", title: "Suporte Humano" },
        { id: "opt_unlock", title: "Desbloqueio de Confiança" },
        { id: "opt_other", title: "Outros" }
      ]}];
      console.log(`📡 Enviando List Message para ${from}`);
      await waService.sendListMessage(from, menuText, "Ver Opções", sections);
    } catch (err: any) {
      console.log("⚠️ Falha ao enviar menu interativo, usando fallback de texto.", err.message);
      await waService.sendTextMessage(from, menuText);
    }
  }
  return menuText;
}

interface DashboardMediaMeta {
  fileName?: string | null;
  mimeType?: string | null;
  duration?: number | null;
  zapiMessageId?: string | null;
  zapiZaapId?: string | null;
  avatarUrl?: string | null;
  userLabel?: string | null;
  clearUnread?: boolean;
  replyTo?: Record<string, unknown> | null;
  chatLid?: string | null;
  phoneValue?: string | null;
}

const GENERIC_CONTACT_NAMES = new Set([
  "cliente",
  "cliente whatsapp",
  "cliente sem nome",
  "sem nome",
  "whatsapp",
]);

function pickBestChatDoc(
  docs: admin.firestore.DocumentSnapshot[]
): admin.firestore.DocumentSnapshot {
  const existing = docs.filter((d) => d.exists);
  existing.sort((a, b) => {
    const da = a.data() || {};
    const dbData = b.data() || {};
    // 1. Prefere conversa já vinculada ao ISPFY
    const aLinked = da.ispfy_id || da.ixc_id ? 1 : 0;
    const bLinked = dbData.ispfy_id || dbData.ixc_id ? 1 : 0;
    if (aLinked !== bLinked) return bLinked - aLinked;
    // 2. Prefere ID que seja telefone real em vez de @lid
    const aIsLid = a.id.includes("@lid") ? 0 : 1;
    const bIsLid = b.id.includes("@lid") ? 0 : 1;
    if (aIsLid !== bIsLid) return bIsLid - aIsLid;
    // 3. Prefere conversa já consolidada (com foto/avatar do cliente)
    const aHasAvatar = da.avatar ? 1 : 0;
    const bHasAvatar = dbData.avatar ? 1 : 0;
    if (aHasAvatar !== bHasAvatar) return bHasAvatar - aHasAvatar;
    // 4. Mais recente
    const aMs = da.lastMessageTime?.toMillis ? da.lastMessageTime.toMillis() : 0;
    const bMs = dbData.lastMessageTime?.toMillis ? dbData.lastMessageTime.toMillis() : 0;
    return bMs - aMs;
  });
  return existing[0];
}

/**
 * Mescla com segurança um chat duplicado com ID `@lid` para dentro do chat canônico de telefone real
 * e remove o documento `@lid` duplicado da lista lateral.
 */
async function mergeStrayLidChatIntoCanonical(
  strayLidDocId: string,
  targetChatId: string
): Promise<void> {
  if (!strayLidDocId || !targetChatId || strayLidDocId === targetChatId) return;
  if (!strayLidDocId.includes("@lid")) return;

  try {
    const strayRef = db.collection("chat").doc(strayLidDocId);
    const straySnap = await strayRef.get();
    if (!straySnap.exists) return;

    const targetRef = db.collection("chat").doc(targetChatId);
    const msgsSnap = await strayRef.collection("mensagens").limit(50).get();

    for (const msgDoc of msgsSnap.docs) {
      const mData = msgDoc.data();
      const zapiId = String(mData.zapiMessageId || "").trim();
      let alreadyExists = false;
      if (zapiId) {
        const dup = await targetRef
          .collection("mensagens")
          .where("zapiMessageId", "==", zapiId)
          .limit(1)
          .get()
          .catch(() => null);
        if (dup && !dup.empty) alreadyExists = true;
      }
      if (!alreadyExists) {
        await targetRef.collection("mensagens").add({
          ...mData,
          skipWhatsappSync: true,
          mergedFromLid: strayLidDocId,
        });
      }
      await msgDoc.ref.delete();
    }

    await strayRef.delete();
    console.log(
      `🧹 [LID-MERGE] Chat duplicado ${strayLidDocId} (${msgsSnap.size} msgs) mesclado em ${targetChatId} e removido.`
    );
  } catch (err: any) {
    console.warn(
      `⚠️ [LID-MERGE] Falha ao mesclar ${strayLidDocId} em ${targetChatId}:`,
      err?.message || err
    );
  }
}

interface ResolvedChatTarget {
  chatId: string;
  phone: string;
  resolvedName?: string | null;
  resolvedAvatar?: string | null;
}

/**
 * Resolve sempre o mesmo documento `chat/{chatId}` no Firestore, evitando chats duplicados
 * por variação de 9º dígito, DDI 55, campo `phone` ou identificador `@lid` enviado pelo celular.
 */
async function resolveCanonicalChatTarget(params: {
  rawPhoneDigits: string;
  chatLid: string | null;
  contactName: string;
  zapiBaseUrl: string;
  zapiToken: string;
}): Promise<ResolvedChatTarget> {
  const { chatLid, contactName, zapiBaseUrl, zapiToken } = params;
  let phoneDigits = params.rawPhoneDigits;
  let resolvedName: string | null = null;
  let resolvedAvatar: string | null = null;
  const strayLidDocIds = new Set<string>();

  // 1. Busca direta por chatLid salvo anteriormente em um chat real (não-@lid)
  if (chatLid) {
    const [lidQuerySnap, directLidSnap] = await Promise.all([
      db
        .collection("chat")
        .where("chatLid", "==", chatLid)
        .limit(5)
        .get()
        .catch(() => null),
      db
        .collection("chat")
        .doc(chatLid)
        .get()
        .catch(() => null),
    ]);

    const lidDocs: admin.firestore.DocumentSnapshot[] = [];
    if (lidQuerySnap && !lidQuerySnap.empty) {
      lidDocs.push(...lidQuerySnap.docs);
    }
    if (directLidSnap && directLidSnap.exists && !lidDocs.some((d) => d.id === directLidSnap.id)) {
      lidDocs.push(directLidSnap);
    }

    for (const d of lidDocs) {
      if (d.id.includes("@lid")) {
        strayLidDocIds.add(d.id);
      }
    }

    const realPhoneLidDocs = lidDocs.filter((d) => !d.id.includes("@lid"));
    if (realPhoneLidDocs.length > 0) {
      const best = pickBestChatDoc(realPhoneLidDocs);
      const bestPhone = String(best.data()?.phone || phoneDigits || best.id);
      for (const strayId of strayLidDocIds) {
        await mergeStrayLidChatIntoCanonical(strayId, best.id);
      }
      return { chatId: best.id, phone: bestPhone };
    }
  }

  // Helper que tenta localizar chat existente por todas as variações BR do telefone (docId + campo phone)
  const findByPhoneDigits = async (
    digits: string
  ): Promise<ResolvedChatTarget | null> => {
    const variants = buildBrPhoneVariants(digits);
    if (variants.length === 0) return null;

    // 2a. Batch getAll por docId (1 única RPC!)
    const idSnaps = await db.getAll(...variants.map((v) => db.collection("chat").doc(v)));
    const foundById = idSnaps.filter((s) => s.exists);
    if (foundById.length > 0) {
      const best = pickBestChatDoc(foundById);
      const bestPhone = String(best.data()?.phone || best.id);
      return { chatId: best.id, phone: bestPhone };
    }

    // 2b. Busca pelo campo `phone` (ex: chats antigos criados pelo App com docId = userId)
    const fieldSnap = await db
      .collection("chat")
      .where("phone", "in", variants.slice(0, 10))
      .limit(5)
      .get()
      .catch(() => null);
    if (fieldSnap && !fieldSnap.empty) {
      const nonLidFieldDocs = fieldSnap.docs.filter((d) => !d.id.includes("@lid"));
      const best = pickBestChatDoc(nonLidFieldDocs.length > 0 ? nonLidFieldDocs : fieldSnap.docs);
      const bestPhone = String(best.data()?.phone || digits);
      return { chatId: best.id, phone: bestPhone };
    }

    return null;
  };

  // 2. Se veio apenas @lid (sem telefone real), consulta Z-API /contacts/{lid} (e fallback /chats/{lid})
  if (!phoneDigits && chatLid && zapiBaseUrl) {
    const base = zapiBaseUrl.replace(/\/$/, "");
    const headers = { "Client-Token": zapiToken, Accept: "application/json" };
    const endpoints = [
      `${base}/contacts/${encodeURIComponent(chatLid)}`,
      `${base}/chats/${encodeURIComponent(chatLid)}`,
    ];
    for (const url of endpoints) {
      try {
        const resp = await axios.get(url, { headers, timeout: 6000 });
        const data = resp.data || {};
        const maybePhone = String(data.phone || "").trim();
        const maybeName = String(data.name || data.vname || data.short || "").trim();
        const maybeImg = String(data.imgUrl || data.profileThumbnail || "").trim();
        if (maybeName && !maybeName.includes("@lid") && !resolvedName) {
          resolvedName = maybeName;
        }
        if (maybeImg && /^https?:\/\//i.test(maybeImg) && !resolvedAvatar) {
          resolvedAvatar = maybeImg;
        }
        if (maybePhone && !maybePhone.includes("@lid")) {
          const resolvedDigits = maybePhone.replace(/\D/g, "");
          if (resolvedDigits.length >= 10) {
            phoneDigits = resolvedDigits;
            console.log(`🔗 [LID-RESOLVE] ${chatLid} -> ${resolvedDigits} via ${url.includes("/contacts/") ? "/contacts" : "/chats"}`);
            break;
          }
        }
      } catch {
        // tenta próximo endpoint silenciosamente
      }
    }
  }

  // 3. Busca o chat existente pelo telefone real (seja do webhook ou resolvido via /contacts/{lid})
  if (phoneDigits) {
    const found = await findByPhoneDigits(phoneDigits);
    if (found) {
      for (const strayId of strayLidDocIds) {
        await mergeStrayLidChatIntoCanonical(strayId, found.chatId);
      }
      return { ...found, resolvedName, resolvedAvatar };
    }
  }

  // 4. Fallback seguro para @lid: tenta casar por nome exato único (chatName / contato Z-API)
  if (!phoneDigits && chatLid) {
    const cleanName = String(contactName || resolvedName || "").trim();
    if (
      cleanName.length >= 3 &&
      !cleanName.includes("@lid") &&
      !GENERIC_CONTACT_NAMES.has(cleanName.toLowerCase())
    ) {
      const byNameSnap = await db
        .collection("chat")
        .where("name", "==", cleanName)
        .limit(3)
        .get()
        .catch(() => null);
      const nonLidByName = byNameSnap
        ? byNameSnap.docs.filter((d) => !d.id.includes("@lid"))
        : [];
      if (nonLidByName.length === 1) {
        const docSnap = nonLidByName[0];
        for (const strayId of strayLidDocIds) {
          await mergeStrayLidChatIntoCanonical(strayId, docSnap.id);
        }
        return {
          chatId: docSnap.id,
          phone: String(docSnap.data()?.phone || chatLid),
          resolvedName,
          resolvedAvatar,
        };
      }
    }
  }

  // 5. Conversa realmente nova -> cria com ID canônico (55 + DDD + número ou @lid intacto)
  if (phoneDigits) {
    const canonical =
      phoneDigits.startsWith("55") || phoneDigits.length > 11
        ? phoneDigits
        : `55${phoneDigits}`;
    for (const strayId of strayLidDocIds) {
      await mergeStrayLidChatIntoCanonical(strayId, canonical);
    }
    return { chatId: canonical, phone: canonical, resolvedName, resolvedAvatar };
  }

  const fallbackLid = chatLid || "unknown";
  return { chatId: fallbackLid, phone: fallbackLid, resolvedName, resolvedAvatar };
}

async function logMessageToDashboard(
  cleanPhone: string,
  content: string,
  isAdmin: boolean,
  source?: string,
  firstName?: string,
  cliente?: any,
  mediaUrl?: string | null,
  mediaType?: string | null,
  mediaMeta?: DashboardMediaMeta
) {
  try {
    console.log(`📡 [LOG-DASHBOARD] Iniciando gravação para: ${cleanPhone}`);
    const chatRef = db.collection("chat").doc(cleanPhone);
    const serverTimestamp = admin.firestore.FieldValue.serverTimestamp();

    const update: Record<string, any> = {
      lastMessage: content,
      lastMessageTime: serverTimestamp,
      source: source === "whatsapp_device" ? "whatsapp" : source || (isAdmin ? "system" : "whatsapp"),
      updatedAt: serverTimestamp,
      phone: mediaMeta?.phoneValue || cleanPhone,
    };

    if (mediaMeta?.chatLid) {
      update.chatLid = mediaMeta.chatLid;
    }

    if (mediaMeta?.avatarUrl && !isAdmin) {
      update.avatar = mediaMeta.avatarUrl;
    }

    const safeFirstName =
      firstName && !String(firstName).includes("@lid") ? String(firstName).trim() : "";

    if (!isAdmin) {
      update.unreadCount = admin.firestore.FieldValue.increment(1);
      update.name =
        safeFirstName ||
        cliente?.razao ||
        cliente?.nome_razao ||
        cliente?.nome ||
        "Cliente WhatsApp";
      if (cliente?.id) {
        update.ispfy_id = String(cliente.id);
        update.ixc_id = String(cliente.id);
      }
      update.isOnline = true;
    } else if (source === "whatsapp_device") {
      // Ao responder pelo celular, zera não-lidas no painel e só define nome se a conversa ainda for nova
      if (mediaMeta?.clearUnread !== false) {
        update.unreadCount = 0;
      }
      const existingChat = await chatRef.get();
      const existingName = String(existingChat.data()?.name || "").trim();
      if (!existingChat.exists || !existingName || existingName.includes("@lid")) {
        update.name = safeFirstName || "Cliente WhatsApp";
      }
      if (mediaMeta?.avatarUrl && (!existingChat.exists || !existingChat.data()?.avatar)) {
        update.avatar = mediaMeta.avatarUrl;
      }
    }

    await chatRef.set(update, { merge: true });

    const msgRef = await chatRef.collection("mensagens").add({
      user:
        mediaMeta?.userLabel ||
        (isAdmin
          ? source === "josue_ai"
            ? "Josué IA"
            : "AVL Bot"
          : firstName || "Cliente"),
      content,
      timestamp: serverTimestamp,
      isAdmin,
      skipWhatsappSync: isAdmin ? true : false,
      source: source || (isAdmin ? "system" : "whatsapp"),
      mediaUrl: mediaUrl || null,
      mediaType: mediaType || null,
      mediaName: mediaMeta?.fileName || null,
      mediaMimeType: mediaMeta?.mimeType || null,
      mediaDuration: mediaMeta?.duration ?? null,
      zapiMessageId: mediaMeta?.zapiMessageId || null,
      ...(mediaMeta?.zapiZaapId ? { zapiZaapId: mediaMeta.zapiZaapId } : {}),
      ...(mediaMeta?.replyTo ? { replyTo: mediaMeta.replyTo } : {}),
      ...(isAdmin ? { deliveryStatus: "SENT" } : {}),
    });

    // Indexa mensagens enviadas pelo celular/bot para atualizar ticks (✓✓ azul) e evitar duplicação
    if (isAdmin && (mediaMeta?.zapiMessageId || mediaMeta?.zapiZaapId)) {
      await indexZapiMessageForTracking({
        messageId: mediaMeta.zapiMessageId,
        zaapId: mediaMeta.zapiZaapId,
        collectionPath: `chat/${cleanPhone}/mensagens`,
        docId: msgRef.id,
        chatId: cleanPhone,
      });
    }

    console.log(`✅ [LOG-DASHBOARD] SUCESSO TOTAL para ${cleanPhone}`);
  } catch (err: any) {
    console.error("❌ [LOG-DASHBOARD] ERRO FATAL:", err.message, err.stack);
  }
}

async function handleInvoiceRequest(cliente: any, from: string, ispfyService: IspfyBackendService, waService: WhatsAppService, cleanPhone?: string) {
  const targetPhone = cleanPhone || from.replace(/\D/g, "");
  const nome = cliente.razao || cliente.nome_razao || cliente.nome || "Cliente";
  const firstName = nome.split(" ")[0];
  const cpf = String(cliente.cpf_cnpj || cliente.cnpj_cpf || "").trim();

  let boletos = cpf
    ? await ispfyService.consultarBoletosAssinante(cpf, { status: "aberto" }).catch(() => [])
    : [];

  if (boletos.length === 0 && cliente.id) {
    const faturasObj = await ispfyService.buscarFaturasAbertasPorCliente(cliente.id);
    boletos = faturasObj.map((f: any) => ({
      id: String(f.id),
      vencimento: String(f.data_vencimento || ""),
      valor: String(f.valor || ""),
      linha: String(f.linha_digitavel || ""),
      linkPublico: String(f.link_boleto || f.link || ""),
      pix: String(f.pix_copia_cola || f.qr_code || ""),
    }));
  }

  if (boletos.length === 0) {
    const msg = `✅ ${nome}, não encontrei faturas abertas em seu nome no ISPFY.`;
    await waService.sendTextMessage(from, msg);
    await logMessageToDashboard(targetPhone, msg, true, "system", firstName);
    return;
  }

  await waService.sendTextMessage(from, `🗓️ Localizei *${boletos.length}* fatura(s) em aberto no sistema.`);
  for (const fat of boletos.slice(0, 4)) {
    const valorNum = Number(String(fat.valor || "0").replace(",", "."));
    const valorFmt = Number.isFinite(valorNum) && valorNum > 0
      ? valorNum.toFixed(2).replace(".", ",")
      : fat.valor;
    let msg = `📅 *Vencimento:* ${fat.vencimento}\n💰 *Valor:* R$ ${valorFmt}`;
    if (fat.pix) msg += `\n\n💎 *PIX Copia e Cola:*\n${fat.pix}`;
    if (fat.linha) msg += `\n\n📄 *Linha Digitável:*\n${fat.linha}`;
    const fatLink = fat.linkPublico || fat.linkInterno;
    if (fatLink && fatLink.startsWith("http")) msg += `\n\n💳 *Link do Boleto:*\n${fatLink}`;

    await waService.sendTextMessage(from, msg);
    await logMessageToDashboard(targetPhone, msg, true, "system", firstName);
  }
}

async function processTrustUnlockRequest(from: string, cleanPhone: string, ispfyService: IspfyBackendService, waService: WhatsAppService, sessionRef: admin.firestore.DocumentReference, cliente?: any) {
  if (!cliente) {
    await sessionRef.set({ state: "WAITING_FOR_CPF", pendingAction: "trust_unlock", phone: cleanPhone }, { merge: true });
    const msg = "🤔 Para liberar a sua internet, me informe seu *CPF ou CNPJ* (apenas números).";
    await waService.sendTextMessage(from, msg);
    await logMessageToDashboard(cleanPhone, msg, true, "system");
    return;
  }

  const nome = cliente.razao || cliente.nome_razao || cliente.nome || "Cliente";
  const firstName = nome.split(" ")[0] || "Cliente";

  // Verificar se há rompimento regional antes de gerar falsa expectativa
  const outage = await ispfyService.verificarManutencaoAtivaNaRegiao(
    db,
    cliente.bairro,
    cliente.cidade
  );
  if (outage) {
    const previsao = outage.previsao ? `\n⏱️ *Previsão:* ${outage.previsao}` : "";
    const msg =
      `⚠️ *Aviso Regional — ${cliente.bairro || "Sua Região"}*\n\n` +
      `Identificamos uma *${outage.titulo || outage.motivo || "Manutenção Regional"}* na sua região: ${outage.mensagem || outage.motivo || "Equipe em atuação"}${previsao}\n\n` +
      `O desbloqueio financeiro não restabelece o sinal durante manutenção física da rede. Nossa equipe já está atuando!`;
    await waService.sendTextMessage(from, msg);
    await logMessageToDashboard(cleanPhone, msg, true, "system", firstName);
    return;
  }

  await waService.sendTextMessage(from, `⏳ ${firstName}, aguarde um momento. Verificando seu contrato no ISPFY...`);

  const contratos = await ispfyService.buscarContratosPorCliente(cliente.id);
  if (contratos.length === 0) {
    const msg = "❌ Não encontramos nenhum contrato ativo para este cadastro.";
    await waService.sendTextMessage(from, msg);
    await logMessageToDashboard(cleanPhone, msg, true, "system", firstName);
    return;
  }

  const contratoAlvo =
    contratos.find((c: any) => String(c.status || "").toLowerCase().includes("bloq")) ||
    contratos.find((c: any) => c.ativo !== false && String(c.status || "").toLowerCase() !== "cancelado") ||
    contratos[0];

  const result = await ispfyService.liberarEmConfianca(String(contratoAlvo.id));

  let msg = "";
  if (result.success) {
    msg = `✅ *Sinal Liberado!*\n\n${result.message}\n\nPor favor, *reinicie seu roteador* (tire da tomada por 10 segundos) e aguarde a conexão estabilizar.`;
  } else {
    msg = `⚠️ *Aviso:*\n\n${result.message}\n\nCaso já tenha realizado o pagamento, ele será compensado em breve. Se precisar de ajuda, escolha a opção "Suporte Humano".`;
  }

  await waService.sendTextMessage(from, msg);
  await logMessageToDashboard(cleanPhone, msg, true, "system", firstName);
}

/**
 * 🌐 Proxy seguro para a API do IXC
 * Permite que o app hospedado na Vercel consuma a API do IXC
 * sem problemas de CORS ou exposição do IXC_TOKEN no browser.
 */
export const ixcProxy = functions.https.onRequest(async (req, res) => {
  // Configurar cabeçalhos de CORS manualmente
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, ixcsoft"
  );

  // Tratar requisição OPTIONS (Preflight do CORS)
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  // Obter host do ambiente ou usar padrão real
  let IXC_HOST = process.env.IXC_HOST || "https://coopertecisp.com.br/webservice/v1";
  if (IXC_HOST.includes("/api/ixc")) {
    IXC_HOST = "https://coopertecisp.com.br/webservice/v1";
  }
  const IXC_TOKEN = process.env.IXC_TOKEN;

  try {
    if (!IXC_TOKEN) {
      res.status(500).json({
        error: "Configuration Error",
        message: "IXC_TOKEN is missing in Firebase environment variables",
        debug: {
          host: IXC_HOST,
          hasToken: false,
        },
      });
      return;
    }

    const encodedToken = Buffer.from(IXC_TOKEN).toString("base64");

    // Extrair o sub-path a ser encaminhado para a API
    let subpath = req.path || "";
    
    // Garantir que não duplique a rota da cloud function caso venha na URL original
    if (subpath.startsWith("/ixcProxy")) {
      subpath = subpath.substring("/ixcProxy".length);
    }

    const url = `${IXC_HOST}${subpath}`;
    console.log(`🌐 Proxying ${req.method} request to IXC: ${url}`);

    const response = await axios({
      method: req.method,
      url: url,
      data: req.body,
      params: req.query,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${encodedToken}`,
        "ixcsoft": (req.headers.ixcsoft as string) || "listar",
      },
      httpsAgent: new https.Agent({
        rejectUnauthorized: false,
      }),
    });

    res.status(response.status).json(response.data);
  } catch (error: any) {
    console.error("❌ Erro no Proxy IXC do Firebase:", error.message);

    const errorResponse = {
      error: "Proxy Error",
      message: error.message,
      debug: {
        host: IXC_HOST,
        url: error.config?.url,
        hasToken: !!IXC_TOKEN,
        status: error.response?.status,
        data: error.response?.data,
      },
    };

    if (error.response) {
      res.status(error.response.status).json({
        ...errorResponse,
        error: "Upstream API Error",
        message: typeof error.response.data === "object" ? JSON.stringify(error.response.data) : error.response.data || error.message,
      });
    } else {
      res.status(500).json(errorResponse);
    }
  }
});

/**
 * 🚀 Função invocável para disparar a verificação de faturas manualmente.
 */
export const triggerInvoiceCheckManual = functions.https.onCall(async (_data, context) => {
  verifyAuth(context);
  console.log("⏰ Iniciando verificação MANUAL de faturas via ISPFY solicitada pelo Dashboard...");

  try {
    const totalSent = await executePushDueInvoicesCheck(false);
    console.log(`✅ Verificação MANUAL ISPFY concluída. Enviadas ${totalSent} notificações.`);
    return {
      success: true,
      sent: totalSent,
      message: totalSent > 0
        ? `Foram enviadas ${totalSent} notificações.`
        : "Nenhuma notificação pendente encontrada.",
    };
  } catch (error: any) {
    console.error("❌ Erro global no triggerInvoiceCheckManual:", error);
    throw new functions.https.HttpsError("internal", error.message);
  }
});

/**
 * 🚀 Função invocável para enviar notificações customizadas do Dashboard.
 */
export const sendCustomNotification = functions.https.onCall(async (data, context) => {
  verifyAuth(context);
  const { title, body, userId, target } = data;

  if (!title || !body) {
    throw new functions.https.HttpsError("invalid-argument", "Título e corpo são obrigatórios.");
  }

  try {
    let tokens: { token: string, userId: string, userData: any }[] = [];

    if (target === "all") {
      const usersRef = admin.firestore().collection("users");
      const querySnapshot = await usersRef.where("fcmToken", "!=", null).get();
      querySnapshot.forEach(doc => {
        const docData = doc.data();
        if (docData.fcmToken) tokens.push({ token: docData.fcmToken, userId: doc.id, userData: docData });
      });
    } else if (userId) {
      const userDoc = await admin.firestore().collection("users").doc(userId).get();
      if (userDoc.exists && userDoc.data()?.fcmToken) {
        tokens.push({ token: userDoc.data()!.fcmToken, userId: userDoc.id, userData: userDoc.data() });
      }
    }

    if (tokens.length === 0) {
      return { success: false, sent: 0, message: "Nenhum usuário ou token encontrado para enviar a notificação." };
    }

    const message = {
      notification: {
        title: title,
        body: body,
      },
      data: {
        type: "custom",
        screen: data.screen || "HomePage",
      },
      android: {
        priority: "high" as any,
        notification: {
          channelId: "alerts",
          color: "#5a56c9",
        },
      },
    };

    // Firebase Messaging só aceita enviar multicast para até 500 tokens por vez.
    const notifications: Promise<any>[] = [];
    const tokenBatches: typeof tokens[] = [];
    
    for (let i = 0; i < tokens.length; i += 500) {
      const tokenBatch = tokens.slice(i, i + 500);
      tokenBatches.push(tokenBatch);
      const stringTokens = tokenBatch.map(t => t.token);
      notifications.push(admin.messaging().sendEachForMulticast({ ...message, tokens: stringTokens }));
    }

    const responses = await Promise.all(notifications);
    
    let successCount = 0;
    responses.forEach((res, batchIndex) => {
      successCount += res.successCount;
      
      // Tratar tokens falhos
      if (res.failureCount > 0) {
        res.responses.forEach((resp: any, i: number) => {
          if (!resp.success) {
            const errCode = resp.error?.code;
            if (errCode === 'messaging/registration-token-not-registered' || errCode === 'messaging/invalid-registration-token') {
              console.error(`Token inválido para usuário ${tokenBatches[batchIndex][i].userId}`);
            }
          }
        });
      }
    });

    return { success: true, sent: successCount, message: `Notificação enviada com sucesso para ${successCount} dispositivos.` };
  } catch (error: any) {
    console.error("❌ Erro ao enviar notificação customizada:", error);
    throw new functions.https.HttpsError("internal", error.message);
  }
});

// Comprovantes de pagamento ISPFY são executados exclusivamente por `monitorIspfyPayments`
// (`ispfyPaymentMonitor.ts`), evitando corrida dupla com cron legado.

// =========================================================================
// 🎟️ SISTEMA DE SORTEIOS PAGOS & INTEGRAÇÃO ASAAS
// =========================================================================

async function getAsaasConfig() {
  const doc = await db.collection("settings").doc("asaas_config").get();
  if (!doc.exists) {
    throw new Error("Configuração do Asaas não encontrada no banco de dados.");
  }
  const data = doc.data() || {};
  if (!data.apiKey) {
    throw new Error("Chave de API do Asaas não configurada.");
  }
  return {
    apiKey: String(data.apiKey || "").trim(),
    environment: String(data.environment || "sandbox").trim(),
    webhookToken: String(data.webhookToken || "").trim()
  };
}

async function callAsaas(method: "GET" | "POST", path: string, body: any, config: { apiKey: string, environment: string }) {
  const baseUrl = config.environment === "production" 
    ? "https://api.asaas.com/v3" 
    : "https://api-sandbox.asaas.com/v3";
  
  const headers = {
    "access_token": config.apiKey,
    "Content-Type": "application/json",
    "Accept": "application/json"
  };

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch (e) {
        throw new Error(`Asaas API HTTP ${response.status}: ${errorText}`);
      }
      throw new Error(errorData.errors?.[0]?.description || `HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error: any) {
    console.error(`❌ Erro na API Asaas [${method} ${path}]:`, error.message);
    throw error;
  }
}

/**
 * Cloud Function para criar uma cobrança Pix no Asaas para compra de bilhetes
 */
export const createPaidRafflePayment = functions.https.onCall(async (data, context) => {
  try {
    const { raffleId, clientName, clientCpf, clientPhone, clientEmail, ticketQuantity } = data;

    if (!raffleId || !clientName || !clientCpf || !clientPhone || !ticketQuantity) {
      throw new functions.https.HttpsError("invalid-argument", "Campos obrigatórios ausentes.");
    }

    const qty = parseInt(ticketQuantity);
    if (isNaN(qty) || qty <= 0) {
      throw new functions.https.HttpsError("invalid-argument", "Quantidade de bilhetes inválida.");
    }

    // 1. Obter dados do sorteio
    const raffleSnap = await db.collection("paid_raffles").doc(raffleId).get();
    if (!raffleSnap.exists) {
      throw new functions.https.HttpsError("not-found", "Sorteio não encontrado.");
    }
    const raffleData = raffleSnap.data() || {};
    if (raffleData.status !== "active") {
      throw new functions.https.HttpsError("failed-precondition", "Este sorteio não está ativo.");
    }

    const ticketPrice = parseFloat(raffleData.ticketPrice);
    if (isNaN(ticketPrice) || ticketPrice <= 0) {
      throw new functions.https.HttpsError("failed-precondition", "Preço do bilhete inválido configurado.");
    }

    const totalValue = ticketPrice * qty;

    // 2. Limpar CPF e telefone
    const cleanCpf = clientCpf.replace(/\D/g, "");
    const cleanPhone = clientPhone.replace(/\D/g, "");

    // 3. Obter configuração do Asaas
    const asaasConfig = await getAsaasConfig();

    // 4. Buscar cliente no Asaas ou cadastrar
    let customerId = "";
    console.log(`🔍 [Asaas] Buscando cliente por CPF: ${cleanCpf}`);
    const searchRes = await callAsaas("GET", `/customers?cpfCnpj=${cleanCpf}`, null, asaasConfig);
    
    if (searchRes.data && searchRes.data.length > 0) {
      customerId = searchRes.data[0].id;
      console.log(`✅ [Asaas] Cliente encontrado: ${customerId}`);
    } else {
      console.log(`➕ [Asaas] Cliente não encontrado. Criando novo cliente...`);
      const createCustRes = await callAsaas("POST", "/customers", {
        name: clientName,
        cpfCnpj: cleanCpf,
        email: clientEmail || undefined,
        phone: cleanPhone,
        notificationDisabled: true
      }, asaasConfig);
      customerId = createCustRes.id;
      console.log(`✅ [Asaas] Cliente criado com sucesso: ${customerId}`);
    }

    // 5. Criar documento temporário no Firestore para pegar o ID
    const paymentRef = db.collection("paid_raffle_payments").doc();
    const paymentId = paymentRef.id;

    // 6. Criar cobrança no Asaas
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dueDateStr = tomorrow.toISOString().split("T")[0];

    console.log(`💳 [Asaas] Criando cobrança no Asaas para ${clientName} no valor de R$ ${totalValue.toFixed(2)}`);
    const paymentRes = await callAsaas("POST", "/payments", {
      customer: customerId,
      billingType: "PIX",
      value: totalValue,
      dueDate: dueDateStr,
      description: `Compra de ${qty} bilhete(s) para o sorteio: ${raffleData.title}`,
      externalReference: paymentId
    }, asaasConfig);

    // 7. Buscar QR Code do Pix
    console.log(`📱 [Asaas] Buscando QR Code Pix para pagamento ${paymentRes.id}`);
    const pixRes = await callAsaas("GET", `/payments/${paymentRes.id}/pixQrCode`, null, asaasConfig);

    // 8. Salvar no Firestore
    const newPaymentData = {
      id: paymentId,
      raffleId: raffleId,
      raffleTitle: raffleData.title,
      clientName: clientName,
      clientCpf: cleanCpf,
      clientPhone: cleanPhone,
      clientEmail: clientEmail || "",
      ticketQuantity: qty,
      totalValue: totalValue,
      asaasCustomerId: customerId,
      asaasPaymentId: paymentRes.id,
      paymentStatus: "PENDING",
      pixCode: pixRes.payload,
      pixQrCodeBase64: pixRes.encodedImage,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      confirmedAt: null,
      ticketsGenerated: false
    };

    await paymentRef.set(newPaymentData);
    console.log(`💾 [Firestore] Cobrança Pix salva no banco de dados. ID: ${paymentId}`);

    return {
      success: true,
      paymentId: paymentId,
      pixCode: pixRes.payload,
      pixQrCodeBase64: pixRes.encodedImage,
      totalValue: totalValue,
      raffleTitle: raffleData.title
    };

  } catch (error: any) {
    console.error("❌ Erro em createPaidRafflePayment:", error);
    throw new functions.https.HttpsError("internal", error.message || "Erro interno ao processar pagamento.");
  }
});

/**
 * Webhook HTTP para receber confirmação de pagamentos do Asaas
 */
export const asaasWebhook = functions.https.onRequest(async (req, res) => {
  // Configurar cabeçalhos de CORS manualmente para testes e requisições do browser/frontend
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, asaas-access-token, access_token"
  );

  // Tratar requisição OPTIONS (Preflight do CORS)
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method === "GET") {
    res.status(200).send("Webhook Asaas ativo.");
    return;
  }

  console.log(`🔔 [Webhook Asaas] Requisição recebida. Headers: ${JSON.stringify(req.headers)} | Body: ${JSON.stringify(req.body)}`);

  try {
    const asaasConfig = await getAsaasConfig();
    const requestToken = String(req.headers["asaas-access-token"] || req.headers["access_token"] || req.headers["authorization"] || "").trim();
    const expectedToken = asaasConfig.webhookToken;

    if (expectedToken && requestToken !== expectedToken) {
      console.warn(`⚠️ Token do Webhook inválido ou ausente! Esperado (tamanho ${expectedToken.length}): "${expectedToken}", Recebido (tamanho ${requestToken.length}): "${requestToken || 'NENHUM NO CABEÇALHO'}"`);
      res.status(401).send("Unauthorized: Invalid webhook token.");
      return;
    }

    const { event, payment } = req.body;
    console.log(`🔔 [Webhook Asaas] Recebido evento: ${event} para o pagamento Asaas ID: ${payment?.id} (externalReference: ${payment?.externalReference})`);

    if (event === "PAYMENT_RECEIVED" || event === "PAYMENT_CONFIRMED" || event === "PAYMENT_CREDITED") {
      let paymentId = payment.externalReference;
      let paymentRef = paymentId ? db.collection("paid_raffle_payments").doc(paymentId) : null;
      let paymentSnap = paymentRef ? await paymentRef.get() : null;

      // Fallback: se não achar por externalReference ou se vier vazio, busca pelo asaasPaymentId
      if (!paymentSnap || !paymentSnap.exists) {
        console.warn(`ℹ️ Documento não encontrado por externalReference ("${paymentId}"). Buscando por asaasPaymentId: ${payment?.id}...`);
        const querySnap = await db.collection("paid_raffle_payments").where("asaasPaymentId", "==", String(payment?.id || "")).limit(1).get();
        if (!querySnap.empty) {
          paymentSnap = querySnap.docs[0];
          paymentRef = paymentSnap.ref;
          paymentId = paymentSnap.id;
        } else {
          console.warn(`⚠️ Pagamento não encontrado no Firestore por externalReference nem por asaasPaymentId (${payment?.id}).`);
          res.status(404).send("Not Found: Payment document not found.");
          return;
        }
      }

      if (!paymentRef) {
        res.status(404).send("Not Found: Payment reference missing.");
        return;
      }
      const validPaymentRef = paymentRef;

      const paymentData = paymentSnap.data() || {};
      if (paymentData.paymentStatus === "CONFIRMED") {
        console.log(`ℹ️ Pagamento ${paymentId} já está confirmado no banco.`);
        res.status(200).send("Success: Already confirmed.");
        return;
      }

      const raffleId = paymentData.raffleId;
      const ticketQuantity = paymentData.ticketQuantity;
      const raffleRef = db.collection("paid_raffles").doc(raffleId);

      const ticketNumbers: number[] = [];

      console.log(`🎟️ Gerando ${ticketQuantity} bilhetes para o sorteio ${raffleId} em transação Firestore...`);
      
      const txResult = await db.runTransaction(async (transaction) => {
        const freshPaySnap = await transaction.get(validPaymentRef);
        if (freshPaySnap.data()?.paymentStatus === "CONFIRMED") {
          return { alreadyConfirmed: true };
        }

        const raffleSnapTrans = await transaction.get(raffleRef);
        if (!raffleSnapTrans.exists) {
          throw new Error("Sorteio não encontrado.");
        }
        
        const raffleDataTrans = raffleSnapTrans.data() || {};
        const currentSold = raffleDataTrans.totalTicketsSold || 0;
        const startNumber = currentSold + 100001;

        for (let i = 0; i < ticketQuantity; i++) {
          ticketNumbers.push(startNumber + i);
        }

        transaction.update(raffleRef, {
          totalTicketsSold: currentSold + ticketQuantity
        });

        transaction.update(validPaymentRef, {
          paymentStatus: "CONFIRMED",
          confirmedAt: admin.firestore.FieldValue.serverTimestamp(),
          ticketsGenerated: true,
          tickets: ticketNumbers
        });

        for (const num of ticketNumbers) {
          const ticketRef = db.collection("paid_raffle_tickets").doc(`${raffleId}_${num}`);
          transaction.set(ticketRef, {
            id: `${raffleId}_${num}`,
            raffleId: raffleId,
            paymentId: paymentId,
            clientName: paymentData.clientName,
            clientPhone: paymentData.clientPhone,
            clientCpf: paymentData.clientCpf,
            ticketNumber: num,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
          });
        }

        return { alreadyConfirmed: false };
      });

      if (txResult.alreadyConfirmed) {
        console.log(`ℹ️ Pagamento ${paymentId} já confirmado em execução paralela.`);
        res.status(200).send("Success: Already confirmed.");
        return;
      }

      console.log(`✅ Transação concluída com sucesso! Bilhetes gerados: ${ticketNumbers.join(", ")}`);

            try {
        const { apiKey: whapiApiKey, baseUrl: whapiBaseUrl } = getWhapiConfig();

        if (paymentData.clientPhone) {
          const whapiService = new WhapiService(whapiApiKey, whapiBaseUrl);
          const ticketListStr = ticketNumbers.join(", ");
          const clientNameFirst = (paymentData.clientName || "Cliente").split(" ")[0];

          const text = `✅ *Olá, ${clientNameFirst}!*

Seu pagamento para o sorteio *${paymentData.raffleTitle}* foi confirmado com sucesso! 🎉

Você adquiriu *${ticketQuantity} bilhete(s)*.
Seus números da sorte são:
👉 *${ticketListStr}*

Boa sorte! 🍀
_AVL Telecom_`;

          let enviadoComImagem = false;
          try {
            const ticketImageBase64 = await generateRaffleTicketImage({
              clientName: paymentData.clientName || "Cliente",
              raffleTitle: paymentData.raffleTitle || "Sorteio AVL",
              ticketQuantity,
              ticketNumbers,
            });

            if (ticketImageBase64) {
              const imgResult = await whapiService.sendPaymentReceiptImage(
                paymentData.clientPhone,
                ticketImageBase64,
                text
              );
              if (imgResult.sent) {
                enviadoComImagem = true;
                console.log(`🎟️ Imagem do bilhete da sorte enviada com sucesso para ${paymentData.clientPhone}`);
              } else {
                console.warn(`⚠️ Envio de imagem falhou (${imgResult.error}), tentando texto puro...`);
              }
            }
          } catch (canvasErr: any) {
            console.warn("⚠️ Falha ao gerar imagem do bilhete:", canvasErr.message);
          }

          if (!enviadoComImagem) {
            await whapiService.sendCustomMessage(paymentData.clientPhone, text);
            console.log(`💬 WhatsApp de confirmação em texto enviado para ${paymentData.clientPhone}`);
          }
        } else {
          console.warn("⚠️ Telefone do cliente não encontrado para o pagamento do sorteio.");
        }
      } catch (waErr) {
        console.error("❌ Erro ao enviar notificação de WhatsApp:", waErr);
      }

      res.status(200).send("Success: Payment processed and tickets generated.");
      return;
    }

    res.status(200).send(`Received unhandled event type: ${event}`);

  } catch (error: any) {
    console.error("❌ Erro no webhook Asaas:", error);
    res.status(500).send(`Internal Server Error: ${error.message}`);
  }
});

// --- 4.5. ISPFY PROXY FOR DASHBOARD ---
export const ispfyProxy = functions.https.onRequest(async (req, res) => {
  // Configurar cabeçalhos de CORS manualmente
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, Token"
  );

  // Tratar requisição OPTIONS (Preflight do CORS)
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  // A URL base e o Token devem vir do Environment do Firebase Functions
  let url = "";

  try {
    const ispfyConfig = getIspfyConfig();
    const ISPFY_HOST = ispfyConfig.host;
    const ISPFY_TOKEN = req.headers.token || req.headers.Token || ispfyConfig.token;

    // O req.path geralmente virá como `/api/object/cliente` ou similar.
    // Como a cloud function fica em /ispfyProxy, a url final será ISPFY_HOST + req.path
    let path = req.path;
    if (path === '/') path = ''; // caso a raiz seja chamada

    url = `${ISPFY_HOST}${path}`;
    console.log(`[ISPFY Proxy] Encaminhando ${req.method} para ${url}`, { query: req.query });
    const response = await axios({
      method: req.method,
      url: url,
      params: req.query,
      data: req.body,
      headers: {
        "Content-Type": "application/json",
        "Token": ISPFY_TOKEN,
      },
      httpsAgent: new https.Agent({
        rejectUnauthorized: false
      }),
      validateStatus: () => true,
      timeout: 120000,
    });

    // O ISPFY retorna o próprio ID numérico do ticket criado (ex: 2710) como HTTP status code,
    // o que quebraria Express `res.status(2710)`. Normalizamos para 200 preserving `id`.
    if (response.status < 100 || response.status > 599) {
      res.status(200).send({
        type: "success",
        id: String(response.status),
        recoveredFromStatus: response.status,
        data: response.data,
      });
      return;
    }

    res.status(response.status).send(response.data);
  } catch (error: any) {
    console.error(`[ISPFY Proxy] Erro na requisição para ${url}:`, error.message);
    if (error.response) {
      const errStatus = Number(error.response.status);
      if (errStatus < 100 || errStatus > 599) {
        res.status(200).send({
          type: "success",
          id: String(errStatus),
          recoveredFromStatus: errStatus,
          data: error.response.data,
        });
        return;
      }
      res.status(errStatus).send(error.response.data);
    } else {
      res.status(500).send({ error: "Erro interno no proxy do ISPFY", details: error.message });
    }
  }
});
// --- 5. SECURE API PROXY FOR MOBILE APP & ISPFY AUTOMATIONS ---
export {
  smartOltRebootOnu,
  smartOltGetWifiDetails,
  smartOltSetWifiDetails,
  ixcFetchClient,
  ispfyAuthSubscriber,
  spinPreMixRoulette,
  createCustomToken
} from "./apiProxy";

export * from "./ispfyPaymentMonitor";

export * from "./ispfyCarenciaMonitor";
export * from "./ispfyAutomations";
export * from "./ispfyFinancialReports";
export * from "./panelUsers";
export * from "./ispfyOutageMonitor";
export * from "./zapiSuite";
export { smartOltProxy, smartOltWebhook } from "./smartOltProxy";
export { aiGenerateCopy, aiChatJosue } from "./aiProxy";

/**
 * 🧹 Limpeza automática diária (03:30 BRT) para manter o consumo do Firebase no mínimo:
 * 1) Remove mídias de atendimento em Storage (`chat/` e `chat_media/`) com mais de 30 dias.
 * 2) Remove registros expirados de rastreio (`zapi_message_index`) com mais de 7 dias.
 */
export const cleanupOldChatMediaCron = functions
  .runWith({ memory: "256MB", timeoutSeconds: 180 })
  .pubsub.schedule("30 3 * * *")
  .timeZone("America/Sao_Paulo")
  .onRun(async () => {
    const now = Date.now();
    const mediaCutoffMs = now - 30 * 24 * 60 * 60 * 1000;
    const indexCutoffMs = now - 7 * 24 * 60 * 60 * 1000;

    let deletedStorageFiles = 0;
    let deletedIndexDocs = 0;

    // 1. Limpar arquivos antigos do Storage (chat/ e chat_media/) > 30 dias
    try {
      const bucket = admin.storage().bucket("avl-telecom.appspot.com");
      const prefixes = ["chat/", "chat_media/"];
      const maxDeletesPerRun = 400;

      for (const prefix of prefixes) {
        if (deletedStorageFiles >= maxDeletesPerRun) break;
        const [files] = await bucket.getFiles({ prefix, maxResults: 600 });
        for (const file of files) {
          if (deletedStorageFiles >= maxDeletesPerRun) break;
          const createdRaw = file.metadata?.timeCreated || file.metadata?.updated;
          const createdMs = createdRaw ? Date.parse(String(createdRaw)) : NaN;
          if (Number.isFinite(createdMs) && createdMs < mediaCutoffMs) {
            await file.delete({ ignoreNotFound: true }).catch(() => undefined);
            deletedStorageFiles++;
          }
        }
      }
    } catch (storageErr: any) {
      console.warn("⚠️ [cleanupOldChatMediaCron] Aviso ao limpar Storage:", storageErr.message);
    }

    // 2. Limpar documentos antigos de zapi_message_index > 7 dias
    try {
      const oldSnap = await db
        .collection("zapi_message_index")
        .where("createdAtMs", "<", indexCutoffMs)
        .limit(400)
        .get();

      if (!oldSnap.empty) {
        const batch = db.batch();
        oldSnap.docs.forEach((docSnap) => batch.delete(docSnap.ref));
        await batch.commit();
        deletedIndexDocs = oldSnap.size;
      }
    } catch (indexErr: any) {
      console.warn(
        "⚠️ [cleanupOldChatMediaCron] Aviso ao limpar zapi_message_index:",
        indexErr.message
      );
    }

    console.log(
      `🧹 [cleanupOldChatMediaCron] Concluído: ${deletedStorageFiles} mídias (>30d) e ${deletedIndexDocs} índices (>7d) removidos.`
    );
    return null;
  });

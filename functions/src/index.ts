import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import {WhapiService} from "./whapiService";
import {ClientData, WelcomeMessageLog, UserSession} from "./types";
import { IXCBackendService } from "./ixcService";
import { AiService, Intent } from "./services/aiService";
import { WhatsAppService } from "./services/whatsappService";

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

    if (snapshot.get("mensagem_enviada")) {
      console.log("⚠️ Mensagem já foi enviada anteriormente. Ignorando.");
      return null;
    }

    const whapiApiKey = "37oG32qZ2Ltk15Pm3aOs9il1JOYfYOdM";
    const whapiBaseUrl = "https://gate.whapi.cloud";

    if (!whapiApiKey) {
      console.error("❌ WHAPI_API_KEY não configurado!");
      await updateClientWithError(userId, "Configuração de API não encontrada");
      return null;
    }

    const clientName = clientData.name || clientData.nome || "Cliente";
    const clientPhone = clientData.whatsapp || clientData.phone;

    if (!clientPhone) {
      console.error("❌ Cliente não possui telefone cadastrado");
      await updateClientWithError(userId, "Telefone não cadastrado");
      return null;
    }

    try {
      const whapiService = new WhapiService(whapiApiKey, whapiBaseUrl);
      const result = await whapiService.sendWelcomeMessage(clientName, clientPhone);

      const log: WelcomeMessageLog = {
        clientId: userId,
        clientName: clientName,
        phone: clientPhone,
        status: result.sent ? "success" : "failed",
        error: result.error,
        messageId: result.id,
        timestamp: new Date().toISOString(),
      };

      await admin.firestore().collection("welcome_message_logs").add(log);

      if (result.sent) {
        await snapshot.ref.update({
          mensagem_enviada: true,
          mensagem_enviada_em: admin.firestore.FieldValue.serverTimestamp(),
          mensagem_id: result.id,
        });
        console.log("✅ Mensagem de boas-vindas enviada!");
      } else {
        await snapshot.ref.update({
          mensagem_enviada: false,
          mensagem_erro: result.error,
          mensagem_tentativa_em: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      return log;
    } catch (error) {
      console.error("❌ Erro ao processar cadastro:", error);
      await updateClientWithError(userId, error instanceof Error ? error.message : "Erro desconhecido");
      return null;
    }
  });

async function updateClientWithError(userId: string, errorMessage: string): Promise<void> {
  try {
    await admin.firestore().collection("usuariosDoPreMix").doc(userId).update({
      mensagem_enviada: false,
      mensagem_erro: errorMessage,
      mensagem_tentativa_em: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (error) {
    console.error("Erro ao atualizar documento:", error);
  }
}

// ... (other imports)

/**
 * 📤 Dispara quando o Admin envia uma mensagem no Painel
 * Replica essa mensagem para o WhatsApp E para o App do cliente
 */
export const onDashboardMessageSent = functions.firestore
  .document("chat/{chatId}/mensagens/{messageId}")
  .onCreate(async (snapshot, context) => {
    const messageData = snapshot.data();
    const chatId = context.params.chatId; // Telefone limpo

    if (messageData.isAdmin !== true) return null;

    console.log(`📤 Replicando resposta do painel para: ${chatId}`);

    const whatsappApiKey = process.env.WHAPI_API_KEY || "37oG32qZ2Ltk15Pm3aOs9il1JOYfYOdM";
    const whatsappBaseUrl = process.env.WHAPI_BASE_URL || "https://gate.whapi.cloud";
    const waService = new WhatsAppService(whatsappBaseUrl, whatsappApiKey);

    try {
      // 1. Enviar para WhatsApp
      if (messageData.mediaUrl) {
        await waService.sendMediaMessage(chatId, messageData.mediaUrl, messageData.content);
      } else {
        await waService.sendTextMessage(chatId, messageData.content);
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
            lastMessage: messageData.content,
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
          content: messageData.content,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          isAdmin: true,
          senderId: "admin",
          senderName: "Atendente AVL",
          mediaUrl: messageData.mediaUrl || null,
        });

        // 2.3 Atualizar cabeçalho da sala
        await admin.firestore().collection("chatRooms").doc(roomId).update({
          lastMessage: messageData.content,
          lastMessageTime: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      return true;
    } catch (error) {
      console.error("❌ Erro na replicação da mensagem:", error);
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
export const sendChatNotification = functions.firestore
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
 * 🤖 Webhook para o Bot de WhatsApp
 */
export const whatsappWebhook = functions.runWith({ 
  secrets: ["GEMINI_API_KEY"] 
}).https.onRequest(async (req, res) => {
  if (req.method === "GET") {
    res.status(200).send("Webhook active");
    return;
  }

  try {
    const payload = req.body;
    let messageData = payload.data || (payload.messages && payload.messages[0]) || payload;

    const from = messageData.from || messageData.chatId || messageData.chat_id || messageData.sender || messageData.key?.remoteJid;
    const text = messageData.body || messageData.text?.body || messageData.message?.conversation || (typeof messageData.text === "string" ? messageData.text : undefined);
    const selectionId = messageData.list_reply?.id || messageData.button_reply?.id;
    const isGroup = from?.includes("@g.us") || from?.includes("@group");
    const fromMe = messageData.from_me === true || messageData.fromMe === true || messageData.key?.fromMe === true;

    if (!from || (!text && !selectionId) || isGroup || fromMe) {
      res.status(200).send("Ignored");
      return;
    }

    const cleanPhone = from.replace(/\D/g, "");
    const ixcService = new IXCBackendService(process.env.IXC_HOST!, process.env.IXC_TOKEN!);
    const waService = new WhatsAppService(process.env.WHAPI_BASE_URL!, process.env.WHAPI_API_KEY!);
    const geminiApiKey = process.env.GEMINI_API_KEY;

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

    // Verificar Ativo
    const botConfig = await db.collection("bot_config").doc("global").get();
    if (botConfig.exists && botConfig.data()?.active === false) {
      res.status(200).send("Disabled"); return;
    }

    // --- LOG PARA DASHBOARD ---
    let cliente = await ixcService.getClienteByPhone(cleanPhone);
    const firstName = cliente?.razao ? cliente.razao.split(' ')[0] : undefined;
    await logMessageToDashboard(cleanPhone, text || `Selecionou ${selectionId}`, false, "whatsapp", firstName, cliente);

    if (text?.startsWith("#debug")) {
      await waService.sendTextMessage(from, `🛠️ DEBUG: ${cleanPhone} | ID: ${cliente?.id || "N/A"}`);
      res.status(200).send("OK"); return;
    }

    const sessionRef = db.collection("bot_sessions").doc(cleanPhone);
    const sessionSnap = await sessionRef.get();
    const session = sessionSnap.data() as UserSession | undefined;

    // --- ESTADO: AGUARDANDO CPF ---
    const isOnlyDigits = /^\d+$/.test((text || "").trim());
    const pureNumbers = (text || "").replace(/\D/g, "");
    if (session?.state === "WAITING_FOR_CPF" || (isOnlyDigits && (pureNumbers.length === 11 || pureNumbers.length === 14))) {
      await waService.sendTextMessage(from, "🔍 Buscando cadastro...");
      const clienteByDoc = await ixcService.getClienteByCpfCnpj(pureNumbers);
      if (clienteByDoc) {
        await sessionRef.set({ state: "IDLE" }, { merge: true });
        await handleInvoiceRequest(clienteByDoc, from, ixcService, waService);
      } else {
        await waService.sendTextMessage(from, "❌ Não localizado. Digite novamente.");
      }
      res.status(200).send("OK"); return;
    }

    // --- DETECÇÃO DE INTENÇÃO ---
    console.log(`🤖 Processando mensagem de ${cleanPhone}: ${text || selectionId}`);
    const localResult = detectIntentLocal(text || "");
    let finalIntent = localResult.intent;

    if (selectionId) {
      finalIntent = selectionId === "opt_invoice" ? "request_invoice" : selectionId === "opt_support" ? "human_support" : "other";
    } else if (finalIntent === "other" && geminiApiKey) {
      const aiService = new AiService(geminiApiKey);
      const aiResult = await aiService.detectIntent(text || "");
      finalIntent = aiResult.intent;
    }

    // --- RESPOSTA ---
    if (finalIntent === "request_invoice") {
      await processInvoiceRequest(from, cleanPhone, ixcService, waService, sessionRef, cliente);
    } else if (finalIntent === "human_support") {
      const msg = "🎧 Vou te transferir para um atendente humano. Aguarde.";
      await waService.sendTextMessage(from, msg);
      await logMessageToDashboard(cleanPhone, msg, true, "system");
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

function detectIntentLocal(text: string): { intent: Intent } {
  const t = text.toLowerCase().trim();
  if (["oi", "olá", "ola", "bom dia", "boa tarde", "boa noite"].includes(t)) return { intent: 'greeting' };
  if (t === "1" || t.includes("fatura") || t.includes("boleto") || t.includes("pix")) return { intent: 'request_invoice' };
  if (t === "2" || t.includes("suporte") || t.includes("atendente")) return { intent: 'human_support' };
  return { intent: 'other' };
}

async function processInvoiceRequest(from: string, cleanPhone: string, ixcService: IXCBackendService, waService: WhatsAppService, sessionRef: admin.firestore.DocumentReference, cliente?: any) {
  if (cliente) {
    await handleInvoiceRequest(cliente, from, ixcService, waService);
  } else {
    await sessionRef.set({ state: "WAITING_FOR_CPF", phone: cleanPhone }, { merge: true });
    const msg = "🤔 Não achei seu cadastro pelo telefone. Me informe seu *CPF ou CNPJ* (apenas números).";
    await waService.sendTextMessage(from, msg);
    await logMessageToDashboard(cleanPhone, msg, true, "system");
  }
}

async function sendWelcomeMenu(from: string, waService: WhatsAppService, isFallback: boolean, firstName?: string) {
  const greeting = firstName ? `Olá ${firstName}! 👋` : "Olá! 👋";
  const menuText = `${greeting} Sou o assistente da *AVL Telecom*. 🤖\n\n1. 📄 *Minha Fatura*\n2. 🎧 *Suporte Humano*\n3. ⚙️ *Outros*`;
  
  if (isFallback) {
    await waService.sendTextMessage(from, menuText);
  } else {
    try {
      const sections = [{ title: "Opções", rows: [
        { id: "opt_invoice", title: "Minha Fatura" },
        { id: "opt_support", title: "Suporte Humano" },
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

async function logMessageToDashboard(cleanPhone: string, content: string, isAdmin: boolean, source?: string, firstName?: string, cliente?: any) {
  try {
    const chatRef = db.collection("chat").doc(cleanPhone);
    const serverTimestamp = admin.firestore.FieldValue.serverTimestamp();
    const update: any = { lastMessage: content, lastMessageTime: serverTimestamp };
    if (!isAdmin) {
      update.unreadCount = admin.firestore.FieldValue.increment(1);
      update.name = firstName || cliente?.razao || "Cliente WhatsApp";
      update.phone = cleanPhone;
      if (cliente?.id) update.ixc_id = cliente.id;
    }
    await chatRef.set(update, { merge: true });
    await chatRef.collection("mensagens").add({
      user: isAdmin ? "AVL Bot" : (firstName || "Cliente"),
      content,
      timestamp: serverTimestamp,
      isAdmin,
      source: source || (isAdmin ? "system" : "whatsapp"),
    });
  } catch (err) { console.error("Log error:", err); }
}

async function handleInvoiceRequest(cliente: any, from: string, ixcService: IXCBackendService, waService: WhatsAppService) {
  const faturas = await ixcService.getFaturasAbertas(cliente.id);
  if (faturas.length === 0) {
    const msg = `✅ ${cliente.razao}, não encontrei faturas abertas em seu nome.`;
    await waService.sendTextMessage(from, msg);
    await logMessageToDashboard(cliente.phone || from, msg, true, "system", cliente.razao?.split(' ')[0]);
    return;
  }
  await waService.sendTextMessage(from, `🗓️ Localizei ${faturas.length} fatura(s).`);
  for (const fat of faturas) {
    await ixcService.sendEmailFatura(fat.id);
    const pix = fat.pix_copia_e_cola || await ixcService.getPix(fat.id);
    const link = fat.gateway_link || fat.link_getwere || fat.url_boleto || await ixcService.getBoleto(fat.id);
    let msg = `📅 *Vencimento: ${fat.data_vencimento}*\n💰 *Valor: R$ ${fat.valor}*\n📧 Fatura enviada por e-mail.`;
    if (pix) msg += `\n\n💎 *PIX:*\n\`${pix}\``;
    if (link) msg += `\n\n💳 *Link:*\n${link}`;
    await waService.sendTextMessage(from, msg);
    await logMessageToDashboard(cliente.phone || from, msg, true, "system", cliente.razao?.split(' ')[0]);
  }
}

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import {ClientData, WelcomeMessageLog, UserSession, WhapiResponse} from "./types";
import { IXCBackendService } from "./ixcService";
import { AiService } from "./services/aiService";
import { WhatsAppService } from "./services/whatsappService";
import axios from "axios";
import * as https from "https";

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

    const whapiApiKey = process.env.WHAPI_API_KEY || "";
    const whapiBaseUrl = process.env.WHAPI_BASE_URL || "https://gate.whapi.cloud";

    if (!whapiApiKey || whapiApiKey === "") {
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
      const waService = new WhatsAppService(whapiBaseUrl, whapiApiKey);
      const response = await waService.sendTextMessage(clientPhone, `Olá ${clientName}! Seja bem-vindo à AVL Telecom.`);
      
      const result: WhapiResponse = {
        sent: !!response.id,
        id: response.id,
        message: "Mensagem enviada via WhatsAppService",
      };

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

    if (messageData.isAdmin !== true || messageData.isPrivate === true) return null;

    console.log(`📤 Replicando resposta do painel para: ${chatId}`);

    const whatsappApiKey = process.env.WHAPI_API_KEY || "";
    const whatsappBaseUrl = process.env.WHAPI_BASE_URL || "https://gate.whapi.cloud";
    
    if (!whatsappApiKey) {
      console.error("❌ WHAPI_API_KEY não configurado no ambiente!");
      return null;
    }

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

    const chatIdField = messageData.chat_id || messageData.chatId || messageData.key?.remoteJid || "";
    const senderField = messageData.from || messageData.sender || "";
    
    const from = senderField || chatIdField;
    const text = messageData.body || messageData.text?.body || messageData.message?.conversation || (typeof messageData.text === "string" ? messageData.text : undefined);
    const selectionId = messageData.list_reply?.id || messageData.button_reply?.id;
    
    // Agora verificamos explicitamente o ID do chat e o remetente para ter certeza absoluta se é grupo
    const isGroup = chatIdField.includes("@g.us") || senderField.includes("@g.us") || messageData.isGroup === true || from?.includes("@group");
    const fromMe = messageData.from_me === true || messageData.fromMe === true || messageData.key?.fromMe === true;

    // Extrair nome do remetente (preferência para pushname da Whapi)
    const senderName = messageData.from_name || messageData.pushname || payload.contacts?.[0]?.pushname || "Cliente WhatsApp";

    if (!from || (!text && !selectionId && !messageData.media) || isGroup || fromMe) {
      const reason = !from ? "Sem remetente" : 
                     (!text && !selectionId && !messageData.media) ? "Sem conteúdo" :
                     isGroup ? "Mensagem de grupo" :
                     fromMe ? "Mensagem própria (fromMe)" : "Desconhecido";
                     
      console.log(`⏭️ Webhook ignorado. Motivo: ${reason} | From: ${from} | Texto: ${text}`);
      res.status(200).send("Ignored");
      return;
    }

    const cleanPhone = from.replace(/\D/g, "");

    // DEBUG: Log do objeto completo para entender a estrutura de mídia que está chegando
    console.log(`📩 [WHAPI-DEBUG] Mensagem de ${from}:`, JSON.stringify(messageData));

    const ixcService = new IXCBackendService(process.env.IXC_HOST || "", process.env.IXC_TOKEN || "");
    const waService = new WhatsAppService(process.env.WHAPI_BASE_URL || "https://gate.whapi.cloud", process.env.WHAPI_API_KEY || "");
    const geminiApiKey = process.env.GEMINI_API_KEY;

    // Extrair mídia se houver (captura robusta para diferentes formatos da Whapi)
    const type = messageData.type;
    let mediaUrl = messageData.link || messageData.url || null;
    let mediaType = null;
    let mediaIdToDownload = null;
    let mimeType = null;
    let fileNameToSave = null;

    if (type === 'image' || messageData.image) {
      mediaUrl = messageData.image?.link || messageData.link || messageData.url;
      mediaIdToDownload = messageData.image?.id || (type === 'image' ? messageData.id : null);
      mimeType = messageData.image?.mime_type || 'image/jpeg';
      mediaType = 'image';
    } else if (type === 'audio' || type === 'voice' || messageData.audio || messageData.voice) {
      mediaUrl = messageData.audio?.link || messageData.voice?.link || messageData.link || messageData.url;
      mediaIdToDownload = messageData.audio?.id || messageData.voice?.id || ((type === 'audio' || type === 'voice') ? messageData.id : null);
      mimeType = messageData.audio?.mime_type || messageData.voice?.mime_type || 'audio/ogg';
      mediaType = 'audio';
    } else if (type === 'video' || messageData.video) {
      mediaUrl = messageData.video?.link || messageData.link || messageData.url;
      mediaIdToDownload = messageData.video?.id || (type === 'video' ? messageData.id : null);
      mimeType = messageData.video?.mime_type || 'video/mp4';
      mediaType = 'video';
    } else if (type === 'document' || messageData.document) {
      mediaUrl = messageData.document?.link || mediaUrl;
      mediaIdToDownload = messageData.document?.id || (type === 'document' ? messageData.id : null);
      mimeType = messageData.document?.mime_type || 'application/pdf';
      fileNameToSave = messageData.document?.file_name || messageData.document?.filename;
      mediaType = 'document';
    }

    if (mediaIdToDownload && !mediaUrl && process.env.WHAPI_API_KEY) {
      try {
        console.log(`⏳ Baixando mídia da Whapi... ID: ${mediaIdToDownload}`);
        const mediaBuffer = await waService.downloadMedia(mediaIdToDownload);
        
        const { randomUUID } = require("crypto");
        const token = randomUUID();
        const bucket = admin.storage().bucket("avl-telecom.appspot.com");
        
        // Determinar extensão
        let ext = "";
        if (mimeType.includes("jpeg") || mimeType.includes("jpg")) ext = ".jpg";
        else if (mimeType.includes("png")) ext = ".png";
        else if (mimeType.includes("ogg")) ext = ".ogg";
        else if (mimeType.includes("mp4")) ext = ".mp4";
        else if (mimeType.includes("pdf")) ext = ".pdf";
        
        let finalFileName = fileNameToSave || `${mediaIdToDownload}${ext}`;
        const filePath = `chat_media/${finalFileName}`;
        const file = bucket.file(filePath);
        
        await file.save(mediaBuffer, {
          metadata: {
            contentType: mimeType,
            metadata: { firebaseStorageDownloadTokens: token }
          }
        });
        
        mediaUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(filePath)}?alt=media&token=${token}`;
        console.log(`✅ Mídia baixada e enviada para o Storage: ${mediaUrl}`);
      } catch (err: any) {
        console.error("❌ Falha ao processar download de mídia:", err.message);
      }
    }

    const content = text || (mediaType === 'image' ? '📎 Foto' : mediaType === 'audio' ? '🎵 Áudio' : mediaType === 'document' ? '📄 Documento' : mediaType === 'video' ? '🎥 Vídeo' : '📎 Mídia');

    console.log(`📩 Mensagem processada de ${senderName} (${cleanPhone}): ${content} | Mídia: ${mediaUrl ? 'SIM' : 'NÃO'}`);
    
    // --- BUSCA CLIENTE ANTES DO DASHBOARD ---
    let cliente = await ixcService.getClienteByPhone(cleanPhone);
    const firstName = cliente?.razao ? cliente.razao.split(' ')[0] : senderName.split(' ')[0];

    // --- LOG PARA DASHBOARD ---
    await logMessageToDashboard(cleanPhone, content, false, "whatsapp", firstName, cliente, mediaUrl, mediaType);

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
        await sessionRef.set({ state: "IDLE", pendingAction: null }, { merge: true });
        
        if (session?.pendingAction === "trust_unlock") {
          await processTrustUnlockRequest(from, cleanPhone, ixcService, waService, sessionRef, clienteByDoc);
        } else if (session?.pendingAction === "request_invoice") {
          await handleInvoiceRequest(clienteByDoc, from, ixcService, waService);
        } else {
          const firstName = clienteByDoc.razao ? clienteByDoc.razao.split(' ')[0] : undefined;
          await sendWelcomeMenu(from, waService, false, firstName);
        }
      } else {
        await waService.sendTextMessage(from, "❌ Não localizado. Verifique se o CPF/CNPJ está correto e digite novamente.");
      }
      res.status(200).send("OK"); return;
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

    // --- RESPOSTA ---
    if (finalIntent === "request_invoice") {
      await processInvoiceRequest(from, cleanPhone, ixcService, waService, sessionRef, cliente);
    } else if (finalIntent === "trust_unlock") {
      await processTrustUnlockRequest(from, cleanPhone, ixcService, waService, sessionRef, cliente);
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

function detectIntentLocal(text: string): { intent: string } {
  const t = text.toLowerCase().trim();
  if (["oi", "olá", "ola", "bom dia", "boa tarde", "boa noite"].includes(t)) return { intent: 'greeting' };
  if (t === "1" || t.includes("fatura") || t.includes("boleto") || t.includes("pix") || t.includes("pagamento") || t.includes("2 via") || t.includes("segunda via")) return { intent: 'request_invoice' };
  if (t === "2" || t.includes("suporte") || t.includes("atendente") || t.includes("humano")) return { intent: 'human_support' };
  if (t === "3" || t.includes("desbloqueio") || t.includes("confiança") || t.includes("liberar") || t.includes("sem internet") || t.includes("liberação")) return { intent: 'trust_unlock' };
  return { intent: 'other' };
}

async function processInvoiceRequest(from: string, cleanPhone: string, ixcService: IXCBackendService, waService: WhatsAppService, sessionRef: admin.firestore.DocumentReference, cliente?: any) {
  if (cliente) {
    await handleInvoiceRequest(cliente, from, ixcService, waService);
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

async function logMessageToDashboard(cleanPhone: string, content: string, isAdmin: boolean, source?: string, firstName?: string, cliente?: any, mediaUrl?: string | null, mediaType?: string | null) {
  try {
    console.log(`📡 [LOG-DASHBOARD] Iniciando gravação para: ${cleanPhone}`);
    const chatRef = db.collection("chat").doc(cleanPhone);
    const serverTimestamp = admin.firestore.FieldValue.serverTimestamp();
    
    const update: any = { 
      lastMessage: content, 
      lastMessageTime: serverTimestamp,
      source: source || (isAdmin ? "system" : "whatsapp"),
      updatedAt: serverTimestamp
    };

    if (!isAdmin) {
      update.unreadCount = admin.firestore.FieldValue.increment(1);
      update.name = firstName || cliente?.razao || "Cliente WhatsApp";
      update.phone = cleanPhone;
      if (cliente?.id) update.ixc_id = cliente.id;
      update.isOnline = true;
    }

    console.log("📡 [LOG-DASHBOARD] Tentando atualizar documento principal...");
    await chatRef.set(update, { merge: true });
    console.log("📡 [LOG-DASHBOARD] Documento principal atualizado. Gravando mensagem...");

    await chatRef.collection("mensagens").add({
      user: isAdmin ? "AVL Bot" : (firstName || "Cliente"),
      content,
      timestamp: serverTimestamp,
      isAdmin,
      source: source || (isAdmin ? "system" : "whatsapp"),
      mediaUrl: mediaUrl || null,
      mediaType: mediaType || null,
    });
    
    console.log(`✅ [LOG-DASHBOARD] SUCESSO TOTAL para ${cleanPhone}`);
  } catch (err: any) { 
    console.error("❌ [LOG-DASHBOARD] ERRO FATAL:", err.message, err.stack); 
  }
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
    
    // Evitar [Function: link]
    let link: string | null = fat.gateway_link || fat.link_getwere || fat.url_boleto || null;
    if (typeof link !== 'string' || link.trim() === '') {
      link = await ixcService.getBoleto(fat.id);
    }
    
    let msg = `📅 *Vencimento: ${fat.data_vencimento}*\n💰 *Valor: R$ ${fat.valor}*\n📧 Fatura enviada por e-mail.`;
    if (pix && typeof pix === 'string') msg += `\n\n💎 *PIX:*\n\`${pix}\``;
    if (link && typeof link === 'string' && link.startsWith('http')) msg += `\n\n💳 *Link do Boleto:*\n${link}`;

    await waService.sendTextMessage(from, msg);
    await logMessageToDashboard(cliente.phone || from, msg, true, "system", cliente.razao?.split(' ')[0]);
  }
}

async function processTrustUnlockRequest(from: string, cleanPhone: string, ixcService: IXCBackendService, waService: WhatsAppService, sessionRef: admin.firestore.DocumentReference, cliente?: any) {
  if (!cliente) {
    await sessionRef.set({ state: "WAITING_FOR_CPF", pendingAction: "trust_unlock", phone: cleanPhone }, { merge: true });
    const msg = "🤔 Para liberar a sua internet, me informe seu *CPF ou CNPJ* (apenas números).";
    await waService.sendTextMessage(from, msg);
    await logMessageToDashboard(cleanPhone, msg, true, "system");
    return;
  }

  await waService.sendTextMessage(from, `⏳ ${cliente.razao?.split(' ')[0] || "Cliente"}, aguarde um momento. Verificando possibilidade de desbloqueio...`);

  // Busca contratos
  const contratos = await ixcService.getContratosByCliente(cliente.id);
  if (contratos.length === 0) {
    const msg = "❌ Não encontramos nenhum contrato ativo para este cadastro.";
    await waService.sendTextMessage(from, msg);
    await logMessageToDashboard(cleanPhone, msg, true, "system", cliente.razao?.split(' ')[0]);
    return;
  }

  // Tenta o primeiro contrato. Em cenários reais, poderia buscar qual está bloqueado especificamente.
  const contratoAlvo = contratos.find((c: any) => c.status === 'CM' || c.status === 'B' || c.status_internet === 'CM') || contratos[0];
  
  const result = await ixcService.unlockContract(contratoAlvo.id);
  
  let msg = "";
  if (result.success) {
    msg = `✅ *Sinal Liberado!*\n\n${result.message}\n\nPor favor, **reinicie seu roteador** (tire da tomada por 10 segundos) e aguarde a conexão estabilizar.`;
  } else {
    msg = `⚠️ *Aviso:*\n\n${result.message}\n\nCaso já tenha realizado o pagamento, ele será compensado em breve. Se precisar de ajuda, escolha a opção "Suporte Humano".`;
  }

  await waService.sendTextMessage(from, msg);
  await logMessageToDashboard(cleanPhone, msg, true, "system", cliente.razao?.split(' ')[0]);
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
export const triggerInvoiceCheckManual = functions.https.onCall(async (data, context) => {
  console.log("⏰ Iniciando verificação MANUAL de faturas solicitada pelo Dashboard...");

  try {
    const usersRef = admin.firestore().collection("users");
    const querySnapshot = await usersRef.where("fcmToken", "!=", null).get();

    if (querySnapshot.empty) {
      console.log("ℹ️ Nenhum usuário com token FCM encontrado.");
      return { success: true, sent: 0, message: "Nenhum usuário com token FCM encontrado." };
    }

    const IXC_TOKEN = process.env.IXC_TOKEN || "";
    const auth = Buffer.from(IXC_TOKEN).toString("base64");

    const notifications: Promise<any>[] = [];

    for (const doc of querySnapshot.docs) {
      const userData = doc.data();
      const userId = doc.id;
      const ixcId = userData.clientId || userId;
      const token = userData.fcmToken;

      try {
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
            grid_param: JSON.stringify([
              {TB: "fn_areceber.liberado", OP: "=", P: "S"},
              {TB: "fn_areceber.status", OP: "=", P: "A"},
            ]),
          },
          {
            headers: {Authorization: `Basic ${auth}`, ixcsoft: "listar"},
            timeout: 10000,
          }
        );

        const invoices = response.data?.registros || [];

        for (const inv of invoices) {
          if (inv.status !== "A") continue;

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
              notification: {
                title: title,
                body: body,
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
            notifications.push(
              admin.messaging().send(message).catch((e) => {
                console.error(`Erro ao notificar token ${token}:`, e.message);
              })
            );
          }
        }
      } catch (userError: any) {
        console.error(`❌ Erro ao verificar faturas para usuário ${userId}:`, userError.message);
      }
    }

    await Promise.all(notifications);
    console.log(`✅ Verificação MANUAL concluída. Enviadas ${notifications.length} notificações.`);
    return { success: true, sent: notifications.length, message: `Foram enviadas ${notifications.length} notificações.` };
  } catch (error: any) {
    console.error("❌ Erro global no triggerInvoiceCheckManual:", error);
    throw new functions.https.HttpsError("internal", error.message);
  }
});

/**
 * 🚀 Função invocável para enviar notificações customizadas do Dashboard.
 */
export const sendCustomNotification = functions.https.onCall(async (data, context) => {
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

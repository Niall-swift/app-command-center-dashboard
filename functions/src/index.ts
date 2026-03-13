import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import {WhapiService} from "./whapiService";
import {ClientData, WelcomeMessageLog, UserSession} from "./types";
import { IXCBackendService } from "./ixcService";
import { AiService } from "./services/aiService";
import { WhatsAppService } from "./services/whatsappService";

// Inicializar Firebase Admin
admin.initializeApp();

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

    // Configurações hardcoded (temporário para deploy funcionar)
    const whapiApiKey = "37oG32qZ2Ltk15Pm3aOs9il1JOYfYOdM";
    const whapiBaseUrl = "https://gate.whapi.cloud";

    if (!whapiApiKey) {
      console.error("❌ WHAPI_API_KEY não configurado!");
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
      // Enviar mensagem de boas-vindas
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

/**
 * Atualiza o documento do cliente com informações de erro
 */
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

/**
 * 🏆 Notificação para Vencedores (Pre-mix)
 */
export const sendWinnerNotification = functions.firestore
  .document("winners/{winnerId}")
  .onCreate(async (snap) => {
    const winnerData = snap.data();
    const winnerCpf = winnerData.cpf;

    console.log(`🏆 Novo vencedor detectado: ${winnerData.name} (${winnerCpf})`);

    try {
      const usersRef = admin.firestore().collection("users");
      const cpfNumbers = winnerCpf.replace(/\D/g, "");
      const cpfFormatted = cpfNumbers.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");

      const querySnapshot = await usersRef
        .where("fcmToken", "!=", null)
        .where("cpf", "in", [cpfNumbers, cpfFormatted])
        .get();

      if (querySnapshot.empty) {
        console.log(`⚠️ Nenhum usuário com Token FCM encontrado para o CPF: ${winnerCpf}`);
        return null;
      }

      const notifications: Promise<any>[] = [];
      querySnapshot.forEach((doc) => {
        const token = doc.data().fcmToken;
        const message = {
          notification: {
            title: "🎊 Você Ganhou no Pré-mix! 🎊",
            body: `Parabéns ${winnerData.name}! Você foi o grande vencedor. Abra o app para resgatar!`,
          },
          data: {
            type: "winner",
            screen: "HomePage",
            winnerName: winnerData.name,
          },
          android: {
            priority: "high" as any,
            notification: {channelId: "alerts", color: "#22C55E"},
          },
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
 * 💬 Notificação para Mensagens de Chat
 */
export const sendChatNotification = functions.firestore
  .document("users/{userId}/mensagens/{messageId}")
  .onCreate(async (snap, context) => {
    const messageData = snap.data();
    const userId = context.params.userId;

    // Não notificar se a mensagem foi enviada pelo próprio cliente
    if (messageData.enviadoPor === "cliente") {
      return null;
    }

    console.log(`💬 Nova mensagem de chat para ${userId} de ${messageData.enviadoPor}`);

    try {
      const userDoc = await admin.firestore().collection("users").doc(userId).get();

      if (!userDoc.exists || !userDoc.data()?.fcmToken) {
        console.log(`⚠️ Usuário ${userId} não encontrado ou sem Token FCM`);
        return null;
      }

      const token = userDoc.data()?.fcmToken;
      const message = {
        notification: {
          title: messageData.enviadoPor === "admin" ? "Atendente AVL" : "Assistente AVL",
          body: messageData.texto ?
            messageData.texto.substring(0, 100) + (messageData.texto.length > 100 ? "..." : "") :
            "📎 Mídia recebida",
        },
        data: {
          type: "chat",
          screen: "chat",
          userId: userId,
        },
        android: {
          priority: "high" as any,
          notification: {channelId: "chat", color: "#5a56c9"},
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
 * Webhook para receber mensagens do WhatsApp
 */
export const whatsappWebhook = functions.runWith({ 
  secrets: ["GEMINI_API_KEY"] 
}).https.onRequest(async (req, res) => {
  if (req.method === "GET") {
    res.status(200).send("Webhook active");
    return;
  }

  const payload = req.body;
  console.log("📩 Webhook recebido:", JSON.stringify(payload));

  // Tentar extrair dados da mensagem de diferentes formatos de API (Whapi, Evolution, etc)
  const messageData = payload.data || (payload.messages && payload.messages[0]) || payload; 
  
  const from = messageData.from || messageData.chatId || messageData.chat_id || messageData.sender || messageData.key?.remoteJid;
  const text = messageData.body || messageData.text?.body || messageData.message?.conversation || messageData.message?.extendedTextMessage?.text || (messageData.text);
  const isGroup = from?.includes("@g.us") || from?.includes("@group");
  const fromMe = messageData.fromMe === true || messageData.from_me === true || messageData.key?.fromMe === true;

  console.log("🔍 Extraído:", { from, text, isGroup, fromMe });

  if (!from || !text || isGroup || fromMe) {
    console.log("⏭️ Mensagem ignorada (Filtro inicial)");
    res.status(200).send("Ignored");
    return;
  }

  const cleanPhone = from.replace(/\D/g, "");
  
  const ixcHost = process.env.IXC_HOST || "https://coopertecisp.com.br/webservice/v1";
  const ixcToken = process.env.IXC_TOKEN || "29:ed30004f8207dbe08feb05005d67ea023793429a91210655cbf03fe12b1e4c94";
  const geminiApiKey = process.env.GEMINI_API_KEY; 
  const whatsappApiKey = process.env.WHATSAPP_API_KEY || "37oG32qZ2Ltk15Pm3aOs9il1JOYfYOdM";
  const whatsappBaseUrl = process.env.WHATSAPP_BASE_URL || "https://gate.whapi.cloud";

  if (!geminiApiKey) {
    console.warn("⚠️ GEMINI_API_KEY não configurado. IA desativada.");
  }

  const ixcService = new IXCBackendService(ixcHost, ixcToken);
  const waService = new WhatsAppService(whatsappBaseUrl, whatsappApiKey);

  try {
    const sessionRef = admin.firestore().collection("bot_sessions").doc(cleanPhone);
    const sessionSnap = await sessionRef.get();
    const session = sessionSnap.data() as UserSession | undefined;

    if (session?.state === "WAITING_FOR_CPF") {
      const cpfCnpj = text.replace(/\D/g, "");
      if (cpfCnpj.length >= 11) {
        await waService.sendTextMessage(from, "🔍 Localizando seu cadastro pelo CPF/CNPJ...");
        const cliente = await ixcService.getClienteByCpfCnpj(cpfCnpj);
        if (cliente) {
          await sessionRef.set({ state: "IDLE", updatedAt: admin.firestore.FieldValue.serverTimestamp(), phone: cleanPhone });
          await handleInvoiceRequest(cliente, from, ixcService, waService);
        } else {
          await waService.sendTextMessage(from, "❌ Não encontrei nenhum cliente com esse CPF/CNPJ. Por favor, digite novamente ou fale com um atendente.");
        }
        res.status(200).send("OK");
        return;
      }
    }

    if (geminiApiKey) {
      const aiService = new AiService(geminiApiKey);
      const result = await aiService.detectIntent(text);
      console.log("🤖 IA Detectou:", result.intent);

      // SÓ RESPONDE SE FOR FATURA/BOLETO
      if (result.intent === "request_invoice") {
        await waService.sendTextMessage(from, "📄 Entendido! Vou buscar sua fatura agora.");
        const cliente = await ixcService.getClienteByPhone(cleanPhone);
        if (cliente) {
          await handleInvoiceRequest(cliente, from, ixcService, waService);
        } else {
          await sessionRef.set({ state: "WAITING_FOR_CPF", updatedAt: admin.firestore.FieldValue.serverTimestamp(), phone: cleanPhone });
          await waService.sendTextMessage(from, "🤔 Não consegui localizar seu cadastro pelo número de telefone. Por favor, me informe o seu *CPF ou CNPJ* (apenas números) para eu achar seu boleto.");
        }
      } else {
        console.log("🤐 Ignorando mensagem (intenção não relacionada a fatura):", result.intent);
      }
    } else {
        // Fallback simples se não houver IA - Também restrito a faturas
        if (text.toLowerCase().includes("fatura") || text.toLowerCase().includes("boleto") || text.toLowerCase().includes("segunda via") || text.toLowerCase().includes("pagamento")) {
            await waService.sendTextMessage(from, "📄 Buscando sua fatura...");
            const cliente = await ixcService.getClienteByPhone(cleanPhone);
            if (cliente) {
              await handleInvoiceRequest(cliente, from, ixcService, waService);
            } else {
              await sessionRef.set({ state: "WAITING_FOR_CPF", updatedAt: admin.firestore.FieldValue.serverTimestamp(), phone: cleanPhone });
              await waService.sendTextMessage(from, "🤔 Não localizei seu telefone no sistema. Para eu te enviar o boleto, poderia informar seu *CPF ou CNPJ*?");
            }
        }
    }

    res.status(200).send("OK");
  } catch (error) {
    console.error("Erro no Webhook:", error);
    res.status(200).send("OK with error"); // Always return 200 to WhatsApp to avoid retries
  }
});

async function handleInvoiceRequest(cliente: any, from: string, ixcService: IXCBackendService, waService: WhatsAppService) {
  const faturas = await ixcService.getFaturasAbertas(cliente.id);
  
  if (faturas.length === 0) {
    await waService.sendTextMessage(from, `✅ Olá ${cliente.razao || cliente.nome}, não encontrei faturas abertas no seu cadastro. Tudo em dia! 🎉`);
    return;
  }

  for (const fat of faturas) {
    let msg = `📅 *Fatura Vencimento: ${fat.data_vencimento}*\n💰 Valor: R$ ${fat.valor}\n\n`;
    if (fat.pix_copia_e_cola) {
      msg += `💎 *PIX Copia e Cola:*\n${fat.pix_copia_e_cola}`;
    }
    await waService.sendTextMessage(from, msg);
    const boletoLink = fat.url_boleto || await ixcService.getBoleto(fat.id);
    if (boletoLink) {
      await waService.sendTextMessage(from, `📑 Baixar Boleto PDF:\n${boletoLink}`);
    }
  }
}
